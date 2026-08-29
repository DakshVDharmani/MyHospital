"""Self-contained copy of ml/src/predict.py's RiskModel — deliberately not
imported from src/, so the service never depends on the training code and
still works if database/ and src/ are deleted from the repo later.
"""

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb


def _prettify(raw: str) -> str:
    if raw.startswith("triage_vital_"):
        return "Vital: " + raw[len("triage_vital_"):].replace("_", " ").upper()
    if raw.startswith("missingindicator_"):
        return "Not recorded: " + _prettify(raw[len("missingindicator_"):])
    if raw.startswith("cc_"):
        return "Chief complaint: " + raw[len("cc_"):].replace("_", " ")
    return raw.replace("_", " ").capitalize()


class RiskModel:
    def __init__(self, bundle_path: Path):
        bundle = joblib.load(bundle_path)
        self.model = bundle["model"]
        self.preprocessor = bundle["preprocessor"]
        self.feature_columns: list[str] = bundle["feature_columns"]
        self.priority_order: dict[str, int] = bundle["priority_order"]
        self._label_by_score = {v: k for k, v in self.priority_order.items()}
        self._max_score = max(self.priority_order.values())

        # Naming convention from config.py: everything not a triage vital,
        # gender, or arrivalmode is a plain numeric flag/count. Used only to
        # aggregate one-hot/indicator columns back to their raw feature for
        # explain() — doesn't need to be in the saved bundle since it's
        # derived purely from feature_columns itself.
        self._categorical_raw = [c for c in ("arrivalmode",) if c in self.feature_columns]

    def _nearest_label(self, score: float) -> str:
        clamped = max(0, min(self._max_score, round(score)))
        return self._label_by_score[clamped]

    def score_records(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Scores a list of patient dicts, returning risk_score + label for each,
        in the same order given.

        A record doesn't need every one of the ~570 feature columns — most
        callers will only know a handful of chief-complaint/history flags for
        any given patient. Anything absent is left as NaN and goes through
        the same imputers the model was trained with (median for numeric/
        vitals, most-frequent for the binary/categorical fields), so an
        absent history flag defaults the way "no" would.
        """
        df = pd.DataFrame(records)
        for col in self.feature_columns:
            if col not in df.columns:
                df[col] = float("nan")

        X = df[self.feature_columns]
        X_enc = self.preprocessor.transform(X)
        raw_scores = self.model.predict(X_enc)
        clipped = np.clip(raw_scores, 0, self._max_score)

        return [
            {"risk_score": float(score), "priority_label": self._nearest_label(score)}
            for score in clipped
        ]

    def _raw_feature_of(self, encoded_name: str) -> str:
        """Maps one encoded column (post-ColumnTransformer) back to the raw
        feature it came from — collapses one-hot dummies like
        'arrivalmode_ambulance' back to 'arrivalmode' so a category doesn't
        show up as N separate half-meaningless factors."""
        # Strip the ColumnTransformer's "<transformer_name>__" prefix.
        name = encoded_name.split("__", 1)[-1]
        for raw in self._categorical_raw:
            if name == raw or name.startswith(raw + "_"):
                return raw
        return name

    def explain_records(self, records: list[dict[str, Any]], top_n: int = 6) -> list[dict[str, Any]]:
        """Same scoring as score_records, plus a `factors` list per patient —
        real per-prediction SHAP contributions from the trained XGBoost model
        (via its built-in pred_contribs), not the aggregate/global feature
        importances evaluate.py reports. Positive contribution = pushed the
        risk score up for *this* patient specifically.
        """
        df = pd.DataFrame(records)
        for col in self.feature_columns:
            if col not in df.columns:
                df[col] = float("nan")

        X = df[self.feature_columns]
        X_enc = self.preprocessor.transform(X)
        encoded_names = list(self.preprocessor.get_feature_names_out())

        dmatrix = xgb.DMatrix(X_enc, feature_names=encoded_names)
        contribs = self.model.get_booster().predict(dmatrix, pred_contribs=True)
        # Last column is the bias/base-value term, not a feature.
        feature_contribs, bias = contribs[:, :-1], contribs[:, -1]

        raw_scores = self.model.predict(X_enc)
        clipped = np.clip(raw_scores, 0, self._max_score)

        results = []
        for row_idx, score in enumerate(clipped):
            # Collapse one-hot/indicator columns back to their raw feature,
            # summing contributions that belong to the same original field.
            by_raw: dict[str, float] = {}
            for col_idx, encoded_name in enumerate(encoded_names):
                raw = self._raw_feature_of(encoded_name)
                by_raw[raw] = by_raw.get(raw, 0.0) + float(feature_contribs[row_idx, col_idx])

            ranked = sorted(by_raw.items(), key=lambda kv: abs(kv[1]), reverse=True)[:top_n]
            max_abs = max((abs(v) for _, v in ranked), default=1.0) or 1.0

            factors = [
                {
                    "label": _prettify(raw),
                    "weight": round(abs(value) / max_abs, 3),
                    "direction": "neg" if value > 0 else "pos",  # neg = raises risk, matches ReasoningGraph's convention
                    "note": f"{'+' if value > 0 else ''}{value:.2f} risk points for this patient",
                }
                for raw, value in ranked
            ]

            results.append(
                {
                    "risk_score": float(score),
                    "priority_label": self._nearest_label(score),
                    "base_rate": float(bias[row_idx]),
                    "factors": factors,
                }
            )
        return results

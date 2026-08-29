"""Self-contained copy of ml/src/predict.py's RiskModel — deliberately not
imported from src/, so the service never depends on the training code and
still works if database/ and src/ are deleted from the repo later.
"""

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


class RiskModel:
    def __init__(self, bundle_path: Path):
        bundle = joblib.load(bundle_path)
        self.model = bundle["model"]
        self.preprocessor = bundle["preprocessor"]
        self.feature_columns: list[str] = bundle["feature_columns"]
        self.priority_order: dict[str, int] = bundle["priority_order"]
        self._label_by_score = {v: k for k, v in self.priority_order.items()}
        self._max_score = max(self.priority_order.values())

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

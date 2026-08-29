"""Scores the held-out test split against the saved model and writes
weights/metrics.json — MAE/RMSE on the 1-5 risk scale, per-ESI-level
accuracy, and a confusion matrix.
"""

import json

import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, mean_absolute_error, mean_squared_error

import config
from predict import RiskModel


def main() -> None:
    model = RiskModel(config.MODEL_PATH)
    label_by_risk = {v: k for k, v in config.PRIORITY_ORDER.items()}

    test_df = pd.read_csv(config.TEST_CSV)
    y_true = test_df[config.TARGET_COLUMN].astype(float)

    records = test_df[config.FEATURE_COLUMNS].to_dict(orient="records")
    scored = model.score_records(records)
    y_pred = np.array([r["risk_score"] for r in scored])

    mae = mean_absolute_error(y_true, y_pred)
    rmse = mean_squared_error(y_true, y_pred) ** 0.5

    true_labels = y_true.map(label_by_risk).values
    predicted_labels = np.array([r["priority_label"] for r in scored])
    label_accuracy = float(np.mean(predicted_labels == true_labels))

    ordered_labels = sorted(config.PRIORITY_ORDER, key=config.PRIORITY_ORDER.get)
    cm = confusion_matrix(true_labels, predicted_labels, labels=ordered_labels)
    per_class_accuracy = {
        label: float(cm[i, i] / cm[i].sum()) if cm[i].sum() else None
        for i, label in enumerate(ordered_labels)
    }

    # Feature importances, mapped back through the one-hot/indicator-expanded
    # names the preprocessor produced, for a sanity check on what's driving risk.
    feature_names = model.preprocessor.get_feature_names_out()
    importances = sorted(
        zip(feature_names, model.model.feature_importances_.tolist()),
        key=lambda kv: kv[1],
        reverse=True,
    )

    metrics = {
        "n_test_rows": len(test_df),
        "mae_risk_scale_1_5": mae,
        "rmse_risk_scale_1_5": rmse,
        "nearest_label_accuracy": label_accuracy,
        "per_class_accuracy": per_class_accuracy,
        "confusion_matrix": {"labels": ordered_labels, "matrix": cm.tolist()},
        "top_feature_importances": importances[:20],
    }

    config.WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    config.METRICS_PATH.write_text(json.dumps(metrics, indent=2))

    print(json.dumps(metrics, indent=2))
    print(f"\nWrote {config.METRICS_PATH}")


if __name__ == "__main__":
    main()

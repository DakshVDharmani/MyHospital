"""Trains an XGBoost regressor to predict a patient's ordinal risk score
(inverted ESI — see config.PRIORITY_ORDER) from triage vitals, chief
complaint, and medical history, and saves everything the service needs to
score a new patient into a single weights/model.joblib bundle.

With ~390K training rows, a k-fold RandomizedSearchCV (which would mean
folds x candidates full fits) is needlessly slow — at this scale a single
held-out validation split is already a stable estimate, so this does a small
random hyperparameter search evaluated directly against config.VAL_CSV, with
early stopping picking each candidate's actual n_estimators.
"""

import time

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

import config

N_CANDIDATES = 12
RNG = np.random.RandomState(config.RANDOM_STATE)


def build_preprocessor() -> ColumnTransformer:
    # Triage vitals are missing 30-50% of the time (not every vital gets
    # taken on every patient) — that missingness may itself be informative,
    # so add_indicator keeps a flag column for it rather than silently
    # imputing it away. Everything else here has ~zero missingness; the
    # median-impute is defensive, not load-bearing.
    vitals_pipe = Pipeline([("impute", SimpleImputer(strategy="median", add_indicator=True))])
    numeric_pipe = Pipeline([("impute", SimpleImputer(strategy="median"))])
    binary_pipe = Pipeline([("impute", SimpleImputer(strategy="most_frequent"))])
    categorical_pipe = Pipeline(
        [
            ("impute", SimpleImputer(strategy="constant", fill_value="Unknown")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    return ColumnTransformer(
        [
            ("vitals", vitals_pipe, config.TRIAGE_VITALS),
            ("numeric", numeric_pipe, config.NUMERIC_FEATURES),
            ("binary", binary_pipe, config.BINARY_FEATURES),
            ("categorical", categorical_pipe, config.CATEGORICAL_FEATURES),
        ]
    )


def load_split(path) -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(path)
    X = df[config.FEATURE_COLUMNS]
    y = df[config.TARGET_COLUMN].astype(float)
    return X, y


def sample_params() -> dict:
    return {
        "max_depth": int(RNG.randint(4, 10)),
        "learning_rate": float(RNG.uniform(0.03, 0.25)),
        "subsample": float(RNG.uniform(0.6, 1.0)),
        "colsample_bytree": float(RNG.uniform(0.5, 1.0)),
        "min_child_weight": int(RNG.randint(1, 10)),
        "reg_lambda": float(RNG.uniform(0.5, 4.0)),
    }


def main() -> None:
    X_train, y_train = load_split(config.TRAIN_CSV)
    X_val, y_val = load_split(config.VAL_CSV)
    print(f"Train: {len(X_train)} rows · Val: {len(X_val)} rows · Features: {len(config.FEATURE_COLUMNS)}")

    preprocessor = build_preprocessor()
    X_train_enc = preprocessor.fit_transform(X_train)
    X_val_enc = preprocessor.transform(X_val)
    print(f"Encoded feature count: {X_train_enc.shape[1]}")

    best_model = None
    best_mae = float("inf")
    best_params = None

    for i in range(N_CANDIDATES):
        params = sample_params()
        t0 = time.time()
        model = XGBRegressor(
            objective="reg:squarederror",
            random_state=config.RANDOM_STATE,
            n_estimators=800,
            early_stopping_rounds=30,
            eval_metric="mae",
            tree_method="hist",
            n_jobs=-1,
            **params,
        )
        model.fit(X_train_enc, y_train, eval_set=[(X_val_enc, y_val)], verbose=False)
        val_mae = mean_absolute_error(y_val, model.predict(X_val_enc))
        elapsed = time.time() - t0
        print(
            f"[{i + 1}/{N_CANDIDATES}] val_mae={val_mae:.4f} "
            f"best_iter={model.best_iteration} ({elapsed:.1f}s) params={params}"
        )
        if val_mae < best_mae:
            best_mae, best_model, best_params = val_mae, model, params

    print(f"\nBest val MAE: {best_mae:.4f} (risk scale is 1-5)")
    print(f"Best params: {best_params}")

    config.WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": best_model,
            "preprocessor": preprocessor,
            "feature_columns": config.FEATURE_COLUMNS,
            "priority_order": config.PRIORITY_ORDER,
        },
        config.MODEL_PATH,
    )
    print(f"Saved model bundle -> {config.MODEL_PATH}")


if __name__ == "__main__":
    main()

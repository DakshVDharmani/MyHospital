"""Loads the raw .rdata export, drops unlabeled/malformed rows, cleans the
handful of fields that need it, and writes a 70/15/15 train/val/test split
(stratified on esi) into database/.

Run discover_schema.py once first (generates feature_schema.json), then this,
before train.py.
"""

import pandas as pd
import pyreadr
from sklearn.model_selection import train_test_split

import config


def load_raw() -> pd.DataFrame:
    result = pyreadr.read_r(str(config.RAW_RDATA))
    df = next(iter(result.values()))
    print(f"Loaded {config.RAW_RDATA} -> {df.shape[0]} rows, {df.shape[1]} columns")
    print(f"\n{config.TARGET_COLUMN!r} value counts (incl. missing):")
    print(df[config.TARGET_COLUMN].value_counts(dropna=False))
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df[config.FEATURE_COLUMNS + [config.TARGET_COLUMN]].copy()

    missing_target = df[config.TARGET_COLUMN].isna().sum()
    df = df.dropna(subset=[config.TARGET_COLUMN])
    print(f"Dropped {missing_target} rows with no {config.TARGET_COLUMN!r} label -> {df.shape[0]} rows remain")

    # esi arrives as the category strings '1'..'5' (1 = most urgent). Invert
    # it to the "higher = more urgent" risk scale everything else here uses
    # (matches config.PRIORITY_ORDER: ESI 1 -> risk 5, ESI 5 -> risk 1), and
    # store the already-numeric risk score directly — train.py/evaluate.py
    # read it as a plain regression target, no further mapping needed.
    esi_str_to_risk = {"1": 5, "2": 4, "3": 3, "4": 2, "5": 1}
    df[config.TARGET_COLUMN] = df[config.TARGET_COLUMN].astype(str).map(esi_str_to_risk)

    df["age"] = pd.to_numeric(df["age"], errors="coerce")
    df["gender"] = df["gender"].map({"Male": 1, "Female": 0})
    df["arrivalmode"] = df["arrivalmode"].astype(str).replace({"nan": "Unknown"}).fillna("Unknown")

    return df


def main() -> None:
    df = load_raw()
    df = clean(df)

    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=config.RANDOM_STATE,
        stratify=df[config.TARGET_COLUMN],
    )
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=config.RANDOM_STATE,
        stratify=temp_df[config.TARGET_COLUMN],
    )

    config.DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    train_df.to_csv(config.TRAIN_CSV, index=False)
    val_df.to_csv(config.VAL_CSV, index=False)
    test_df.to_csv(config.TEST_CSV, index=False)

    print(f"\nWrote {len(train_df)} train / {len(val_df)} val / {len(test_df)} test rows to {config.DATABASE_DIR}")


if __name__ == "__main__":
    main()

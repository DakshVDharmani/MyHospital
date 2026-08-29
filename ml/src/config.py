"""Single source of truth for the dataset schema and paths.

Everything else (discover_schema.py, prepare_data.py, train.py, evaluate.py,
the service) reads column names and the target mapping from here.
"""

import json
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent

# Everything under database/ (the raw .rdata, the generated train/val/test
# splits) is exactly what the user wants to be able to delete once weights/
# has a trained model — nothing outside this folder ever reads from it.
DATABASE_DIR = ML_ROOT / "database"
RAW_RDATA = DATABASE_DIR / "5v_cleandf.rdata"
TRAIN_CSV = DATABASE_DIR / "train.csv"
VAL_CSV = DATABASE_DIR / "valid.csv"
TEST_CSV = DATABASE_DIR / "test.csv"

SCHEMA_PATH = ML_ROOT / "src" / "feature_schema.json"

WEIGHTS_DIR = ML_ROOT / "weights"
MODEL_PATH = WEIGHTS_DIR / "model.joblib"
METRICS_PATH = WEIGHTS_DIR / "metrics.json"

# ---- Schema of maalona/hospital-triage-and-patient-history-data (Kaggle) --
# Real ED visits (Yale-affiliated hospitals); `esi` is the Emergency
# Severity Index a real triage nurse assigned (1 = most urgent, 5 = least),
# backing Hong et al., PLOS ONE 2018.

TARGET_COLUMN = "esi"

# The regressor predicts this ordinal *risk* score (higher = more urgent) —
# i.e. ESI inverted (6 - esi), so it composes with the rest of this project
# the same way notifications/priority.ts already do (higher number = sicker,
# sort descending = who to see first).
PRIORITY_ORDER: dict[str, int] = {"ESI 5": 1, "ESI 4": 2, "ESI 3": 3, "ESI 2": 4, "ESI 1": 5}


def _load_schema() -> dict[str, list[str]]:
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(
            f"{SCHEMA_PATH} not found. Run `python discover_schema.py` first "
            "(it introspects the real .rdata columns instead of hardcoding them)."
        )
    return json.loads(SCHEMA_PATH.read_text())


_schema = _load_schema() if SCHEMA_PATH.exists() else None

# Recorded at triage, before any workup — high missingness (~30-50%) because
# not every vital gets taken on every patient, so these get a missing-value
# indicator column in addition to median imputation (see train.py).
TRIAGE_VITALS: list[str] = _schema["triage_vitals"] if _schema else []

# Chief-complaint flags (this visit) + past-medical-history flags and
# historical utilization counts (prior visits) — all plain numeric, no
# missingness, processed identically.
NUMERIC_FLAGS: list[str] = _schema["numeric_flags"] if _schema else []

# Cleaned in prepare_data.py: gender mapped to 0/1, arrivalmode's ~4% nulls
# filled with the literal string "Unknown" so it's just another category.
NUMERIC_FEATURES = ["age"] + NUMERIC_FLAGS
BINARY_FEATURES = ["gender"]
CATEGORICAL_FEATURES = ["arrivalmode"]

FEATURE_COLUMNS = TRIAGE_VITALS + NUMERIC_FEATURES + BINARY_FEATURES + CATEGORICAL_FEATURES

RANDOM_STATE = 42

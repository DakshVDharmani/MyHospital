"""Run once against a freshly-downloaded copy of the dataset to (re)generate
feature_schema.json — the categorized column lists config.py reads from.

Kept separate from config.py because the real list is ~570 column names long;
hand-maintaining that inline isn't practical, and re-running this is how you'd
regenerate it if the Kaggle export ever changes.
"""

import json

import pandas as pd
import pyreadr

import config

# Columns measured/decided *after* triage (labs, vitals repeated through the
# visit, the final disposition) would leak the future into a triage-time
# model — excluded outright, never just deprioritized.
LEAK_SUFFIXES = ("_last", "_min", "_max", "_median")

# Administrative/demographic columns deliberately left out: `disposition` is
# outcome leakage; race/ethnicity/religion/lang/insurance_status/
# maritalstatus/employstatus are excluded on fairness grounds (a triage-risk
# model conditioning on them is not something to ship) and aren't
# physiologically relevant to acute risk; dep_name/arrival* are hospital
# operations, not the patient's health.
EXCLUDED_ADMIN = [
    "dep_name", "ethnicity", "race", "lang", "religion", "maritalstatus",
    "employstatus", "insurance_status", "disposition", "arrivalmonth",
    "arrivalday", "arrivalhour_bin", "previousdispo",
]

KEPT_DEMOGRAPHIC = ["age", "gender", "arrivalmode"]


def main() -> None:
    result = pyreadr.read_r(str(config.RAW_RDATA))
    df = next(iter(result.values()))
    cols = list(df.columns)

    leak_cols = [c for c in cols if c.endswith(LEAK_SUFFIXES)]
    cc_cols = [c for c in cols if c.startswith("cc_")]
    triage_vital_cols = [c for c in cols if c.startswith("triage_vital")]
    # Everything else that isn't leakage/admin/demographic: mostly binary
    # past-medical-history flags (asthma, acutemi, ...), plus a smaller set of
    # historical-utilization counts (n_edvisits, n_admissions, cxr_count,
    # bloodua_npos, ...). Both are prior-to-this-visit signal, both already
    # plain numeric with no missingness, so they're processed identically —
    # no need to split them into separate pipelines.
    numeric_flag_cols = cc_cols + [
        c for c in cols
        if c not in leak_cols
        and c not in cc_cols
        and c not in triage_vital_cols
        and c not in EXCLUDED_ADMIN
        and c not in KEPT_DEMOGRAPHIC
        and c != config.TARGET_COLUMN
    ]

    schema = {
        "triage_vitals": triage_vital_cols,
        "numeric_flags": numeric_flag_cols,
        "excluded_leak_columns": leak_cols,
        "excluded_admin_columns": EXCLUDED_ADMIN,
    }

    config.SCHEMA_PATH.write_text(json.dumps(schema, indent=2))
    print(f"triage vitals: {len(triage_vital_cols)}")
    print(f"numeric flags (chief complaint + history): {len(numeric_flag_cols)}")
    print(f"excluded (leakage): {len(leak_cols)}")
    print(f"Wrote {config.SCHEMA_PATH}")


if __name__ == "__main__":
    main()

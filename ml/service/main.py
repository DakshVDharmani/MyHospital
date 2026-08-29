"""FastAPI inference service — the only thing that needs to ship to Railway.

Depends only on weights/model.joblib, not on the training code or dataset,
so database/ and src/ can be deleted from the deployed image (and eventually
the repo) without breaking this.

The model takes ~570 features (triage vitals, chief-complaint flags, medical
history flags/counts), which is too many to hand-declare as a rigid Pydantic
schema field-by-field — that list is data-driven and lives in the trained
bundle, not in this file. So a "patient" is just a JSON object of
{feature_name: value}; call GET /schema first to get the exact field list
required (and human labels for the seven core vitals), and validation of
which fields are present happens against that same list at request time.
"""

import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

SERVICE_DIR = Path(__file__).resolve().parent
ML_ROOT = SERVICE_DIR.parent
sys.path.insert(0, str(SERVICE_DIR))

from risk_model import RiskModel  # noqa: E402

MODEL_PATH = ML_ROOT / "weights" / "model.joblib"

app = FastAPI(title="MyHospital Risk Priority Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model: Optional[RiskModel] = None


@app.on_event("startup")
def load_model() -> None:
    global _model
    if not MODEL_PATH.exists():
        raise RuntimeError(
            f"{MODEL_PATH} not found. Run the training pipeline in ml/src/ first, "
            "or make sure weights/model.joblib was copied into the deploy image."
        )
    _model = RiskModel(MODEL_PATH)


class Patient(BaseModel):
    """patient_id is optional and passed straight through so callers can
    match results back up without re-sorting client-side. Every other key is
    a feature name from GET /schema -> feature_columns."""

    patient_id: Optional[str] = None

    class Config:
        extra = "allow"


class RiskResult(BaseModel):
    patient_id: Optional[str] = None
    risk_score: float
    priority_label: str


class PrioritizedResult(RiskResult):
    rank: int


def _require_model() -> RiskModel:
    if _model is None:
        raise HTTPException(503, "Model not loaded")
    return _model


def _as_record(patient: Patient) -> dict[str, Any]:
    return patient.model_dump(exclude={"patient_id"})


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.get("/schema")
def schema():
    """The exact field list a Patient object needs. Vitals are the seven
    fields actually taken at triage; everything else is a 0/1 chief-complaint
    or medical-history flag (or a small prior-utilization count), keyed by
    its raw column name from the training data."""
    model = _require_model()
    return {
        "feature_columns": model.feature_columns,
        "triage_vitals": [c for c in model.feature_columns if c.startswith("triage_vital")],
        "priority_labels": model.priority_order,
    }


@app.post("/predict", response_model=RiskResult)
def predict(patient: Patient):
    model = _require_model()
    try:
        result = model.score_records([_as_record(patient)])[0]
    except ValueError as e:
        raise HTTPException(422, str(e))
    return RiskResult(patient_id=patient.patient_id, **result)


@app.post("/prioritize", response_model=list[PrioritizedResult])
def prioritize(patients: list[Patient]):
    """Scores a list of patients and returns them sorted by descending risk —
    drop-in replacement for a hardcoded, manually-ranked patient queue."""
    model = _require_model()
    if not patients:
        return []

    try:
        results = model.score_records([_as_record(p) for p in patients])
    except ValueError as e:
        raise HTTPException(422, str(e))

    combined = [RiskResult(patient_id=p.patient_id, **r) for p, r in zip(patients, results)]
    combined.sort(key=lambda r: r.risk_score, reverse=True)
    return [PrioritizedResult(rank=i + 1, **r.model_dump()) for i, r in enumerate(combined)]

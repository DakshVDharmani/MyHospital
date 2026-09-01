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
import specialty_router  # noqa: E402

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


class Factor(BaseModel):
    label: str
    weight: float
    direction: str
    note: str


class ExplainResult(RiskResult):
    base_rate: float
    factors: list[Factor]


class PrioritizedResult(RiskResult):
    rank: int


# --- Domain routing + need bracket -----------------------------------------

# Cheap keyword -> chief-complaint-flag extraction so a free-text complaint
# alone still gives the triage-risk model real signal (not just imputed
# medians). Keys are substrings; values are `cc_*` feature columns the model
# was trained on.
_CC_KEYWORDS = {
    "chest pain": "cc_chestpain", "palpitation": "cc_palpitations",
    "short of breath": "cc_shortnessofbreath", "shortness of breath": "cc_shortnessofbreath",
    "difficulty breathing": "cc_breathingproblem", "can't breathe": "cc_breathingproblem",
    "stroke": "cc_strokealert", "face droop": "cc_strokealert", "slurred speech": "cc_strokealert",
    "seizure": "cc_seizure", "numbness": "cc_numbness", "weak": "cc_weakness",
    "headache": "cc_headache", "dizzy": "cc_dizziness", "faint": "cc_syncope",
    "abdominal pain": "cc_abdominalpain", "stomach pain": "cc_abdominalpain",
    "vomit": "cc_vomiting", "diarrhea": "cc_diarrhea", "bleeding": "cc_bleeding",
    "fever": "cc_fever", "cough": "cc_cough", "rash": "cc_rash",
    "back pain": "cc_backpain", "knee pain": "cc_kneepain", "ankle": "cc_anklepain",
    "injury": "cc_injury", "fall": "cc_fall", "trauma": "cc_fulltrauma",
    "suicidal": "cc_suicidal", "depress": "cc_depression", "anxiety": "cc_anxiety",
    "psych": "cc_psychiatricevaluation", "overdose": "cc_overdose",
    "allergic": "cc_allergicreaction", "cardiac arrest": "cc_cardiacarrest",
    "ear pain": "cc_earpain", "dental": "cc_dentalpain", "tooth": "cc_dentalpain",
    "pregnan": "cc_abdominalpainpregnant", "eye": "cc_eyeproblem", "vision": "cc_visionproblem",
}


def _bracket(risk_score: float) -> str:
    if risk_score >= 4.5:
        return "critical"
    if risk_score >= 3.5:
        return "urgent"
    if risk_score >= 2.5:
        return "moderate"
    return "stable"


class RouteRequest(BaseModel):
    """A patient presenting a complaint. `complaint` (free text) is required;
    `vitals` / any extra `cc_*` or history flags are optional and merged into
    the risk model's feature record for a sharper score."""

    patient_id: Optional[str] = None
    complaint: str

    class Config:
        extra = "allow"


class RouteResult(BaseModel):
    patient_id: Optional[str] = None
    specialty: str
    specialty_confidence: float
    specialty_scores: dict
    risk_score: float
    esi_label: str
    need_bracket: str
    model_version: str


@app.post("/route", response_model=RouteResult)
def route(req: RouteRequest):
    """Zero-shot-classifies the complaint into a medical specialty (the
    patient's domain), scores clinical urgency with the trained triage model,
    and buckets that into a need bracket (critical / urgent / moderate /
    stable). The caller persists this to `triage_assessments` and matches
    doctors via the `match_doctors()` SQL function."""
    model = _require_model()

    routed = specialty_router.route(req.complaint)

    record = req.model_dump(exclude={"patient_id", "complaint"})
    low = req.complaint.lower()
    for kw, col in _CC_KEYWORDS.items():
        if kw in low:
            record.setdefault(col, 1)
    try:
        risk = model.score_records([record])[0]
    except ValueError as e:
        raise HTTPException(422, str(e))

    return RouteResult(
        patient_id=req.patient_id,
        specialty=routed["specialty"],
        specialty_confidence=routed["confidence"],
        specialty_scores=routed["scores"],
        risk_score=risk["risk_score"],
        esi_label=risk["priority_label"],
        need_bracket=_bracket(risk["risk_score"]),
        model_version=f"xgb-triage + {specialty_router.MODEL_NAME}",
    )


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


@app.post("/explain", response_model=ExplainResult)
def explain(patient: Patient):
    """Same as /predict, plus which specific fields pushed this patient's
    score up or down — real per-prediction SHAP contributions from the
    trained model, for driving the XAI reasoning graph on the frontend."""
    model = _require_model()
    try:
        result = model.explain_records([_as_record(patient)])[0]
    except ValueError as e:
        raise HTTPException(422, str(e))
    return ExplainResult(patient_id=patient.patient_id, **result)


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

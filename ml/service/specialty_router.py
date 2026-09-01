"""Routes a patient's free-text complaint to a medical specialty (their
"domain") using a PRE-TRAINED zero-shot text classifier — not an LLM.

Model: `typeform/distilbert-base-uncased-mnli` (~250 MB, CPU-friendly). It's a
DistilBERT fine-tuned on MNLI; zero-shot classification works by posing each
candidate specialty as a hypothesis ("This text is about {specialty}.") and
taking the entailment probability. No task-specific training, no dataset,
loaded straight from the HuggingFace hub and cached.
"""

from __future__ import annotations

import os
from functools import lru_cache

MODEL_NAME = os.environ.get("SPECIALTY_MODEL", "typeform/distilbert-base-uncased-mnli")

# enum value  ->  natural-language description fed to the zero-shot model
SPECIALTIES: dict[str, str] = {
    "general_medicine": "a general medical problem, fever, fatigue, or an unclear illness",
    "cardiology": "the heart, chest pain, palpitations, high blood pressure, or circulation",
    "neurology": "the brain or nerves, stroke, seizures, headache, numbness, or dizziness",
    "pulmonology": "the lungs or breathing, cough, shortness of breath, asthma, or pneumonia",
    "gastroenterology": "the stomach, abdomen, digestion, diarrhea, vomiting, or liver",
    "nephrology": "the kidneys, urine problems, or kidney failure",
    "endocrinology": "hormones, diabetes, thyroid, or metabolism",
    "orthopedics": "bones, joints, fractures, back pain, or musculoskeletal injury",
    "dermatology": "the skin, rash, itching, acne, or a skin lesion",
    "ophthalmology": "the eyes or vision problems",
    "otolaryngology": "the ear, nose, throat, sinuses, or hearing",
    "psychiatry": "mental health, anxiety, depression, or a psychiatric crisis",
    "pediatrics": "a child's or infant's health problem",
    "obstetrics_gynecology": "pregnancy, menstruation, or the female reproductive system",
    "urology": "the urinary tract, bladder, prostate, or male reproductive system",
    "oncology": "cancer or a tumor",
    "rheumatology": "arthritis, autoimmune disease, or joint inflammation",
    "emergency_medicine": "a life-threatening emergency, major trauma, or severe bleeding",
    "general_surgery": "a surgical problem such as appendicitis, a hernia, or gallstones",
    "infectious_disease": "an infection, tuberculosis, HIV, or a tropical disease",
    "hematology": "blood disorders, anemia, or clotting problems",
    "allergy_immunology": "allergies, an allergic reaction, or immune deficiency",
    "dentistry": "the teeth, gums, or a dental problem",
}

_LABELS = list(SPECIALTIES.keys())
_HYPOTHESES = list(SPECIALTIES.values())
_BY_HYPOTHESIS = {v: k for k, v in SPECIALTIES.items()}


@lru_cache(maxsize=1)
def _pipeline():
    from transformers import pipeline

    return pipeline("zero-shot-classification", model=MODEL_NAME)


def warmup() -> None:
    _pipeline()


def route(text: str, top_k: int = 5) -> dict:
    """Returns the most likely specialty for a complaint plus ranked scores."""
    clean = (text or "").strip()
    if not clean:
        return {"specialty": "general_medicine", "confidence": 0.0, "scores": {}}

    out = _pipeline()(clean, _HYPOTHESES, multi_label=False)
    ranked = [
        (_BY_HYPOTHESIS[lbl], float(score))
        for lbl, score in zip(out["labels"], out["scores"])
    ]
    return {
        "specialty": ranked[0][0],
        "confidence": round(ranked[0][1], 3),
        "scores": {name: round(s, 3) for name, s in ranked[:top_k]},
    }

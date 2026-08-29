const ML_SERVICE_URL = (import.meta.env.VITE_ML_SERVICE_URL as string | undefined) ?? "http://localhost:8000";

export interface RiskFactor {
  label: string;
  weight: number;
  direction: "pos" | "neg";
  note: string;
}

export interface RiskExplanation {
  risk_score: number;
  priority_label: string;
  base_rate: number;
  factors: RiskFactor[];
}

/** Calls the ml/service /explain endpoint — real per-prediction SHAP
 * contributions from the trained XGBoost triage-risk model, not mock data.
 * `record` is a partial set of the model's ~570 feature columns (see
 * ml/README.md); anything omitted is imputed the same way training did. */
export async function explainRisk(record: Record<string, number | string>): Promise<RiskExplanation> {
  const res = await fetch(`${ML_SERVICE_URL}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    throw new Error(`Risk model request failed (${res.status})`);
  }
  return res.json();
}

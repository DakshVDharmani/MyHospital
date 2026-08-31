import { supabase } from './supabaseClient';

const ML_SERVICE_URL =
  (import.meta.env.VITE_ML_SERVICE_URL as string | undefined) ?? 'http://localhost:8000';

export type NeedBracket = 'critical' | 'urgent' | 'moderate' | 'stable';

export interface RouteResult {
  patient_id: string | null;
  specialty: string;
  specialty_confidence: number;
  specialty_scores: Record<string, number>;
  risk_score: number;
  esi_label: string;
  need_bracket: NeedBracket;
  model_version: string;
}

export interface MatchedDoctor {
  user_id: string;
  doctor_code: string;
  full_name: string;
  specialty: string;
  years_experience: number;
  rating: number;
  city: string | null;
  consultation_fee: number | null;
  current_load: number;
  weekly_capacity: number;
}

export interface TriageOutcome extends RouteResult {
  assessment_id: string | null;
  doctors: MatchedDoctor[];
}

/**
 * Full patient-routing flow:
 *   1. POST /route on the ML service — pre-trained zero-shot classifier picks
 *      the medical specialty (domain); the trained XGBoost triage model scores
 *      urgency and buckets it into a need bracket.
 *   2. Persist the result to `triage_assessments`.
 *   3. Rank doctors of that specialty for the bracket via the `match_doctors`
 *      SQL function.
 *
 * `extras` may carry the 7 triage vitals or any `cc_*` / history flags to
 * sharpen the risk score; all optional.
 */
export async function routePatient(
  complaint: string,
  opts: {
    patientId?: string | null;
    extras?: Record<string, number | string>;
    source?: 'self_report' | 'nurse' | 'voice' | 'system';
    persist?: boolean;
    matchLimit?: number;
  } = {},
): Promise<TriageOutcome> {
  const { patientId = null, extras = {}, source = 'self_report', persist = true, matchLimit = 5 } = opts;

  const res = await fetch(`${ML_SERVICE_URL}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, complaint, ...extras }),
  });
  if (!res.ok) throw new Error(`Triage route failed (${res.status})`);
  const routed = (await res.json()) as RouteResult;

  const { data: doctors } = await supabase.rpc('match_doctors', {
    p_specialty: routed.specialty,
    p_bracket: routed.need_bracket,
    p_limit: matchLimit,
  });
  const matched = (doctors ?? []) as MatchedDoctor[];

  let assessmentId: string | null = null;
  if (persist) {
    const { data: row } = await supabase
      .from('triage_assessments')
      .insert({
        patient_id: patientId,
        complaint_text: complaint,
        specialty: routed.specialty,
        specialty_confidence: routed.specialty_confidence,
        specialty_scores: routed.specialty_scores,
        risk_score: routed.risk_score,
        esi_label: routed.esi_label,
        need_bracket: routed.need_bracket,
        model_version: routed.model_version,
        matched_doctor_ids: matched.map((d) => d.user_id),
        source,
      })
      .select('id')
      .single();
    assessmentId = row?.id ?? null;
  }

  return { ...routed, assessment_id: assessmentId, doctors: matched };
}

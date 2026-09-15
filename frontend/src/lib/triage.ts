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

export interface RankedDoctor extends MatchedDoctor {
  /** great-circle distance from the patient, or null if either side lacks coordinates */
  distanceKm: number | null;
  /** current_load / weekly_capacity, 0-1+ (lower is less busy) */
  loadRatio: number;
}

export interface RoutedMatch extends TriageOutcome {
  /** doctors re-ranked by distance then load; empty if none matched */
  ranked: RankedDoctor[];
  /** ranked[0], or null if no doctor could be matched */
  best: RankedDoctor | null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Full auto-routing flow for booking: classify the complaint, match doctors
 * of the right specialty/urgency bracket, then rank them by how close they
 * are to the patient (when both sides have saved coordinates) and how light
 * their current load is — so the patient never has to pick a doctor by name.
 */
export async function findBestDoctor(
  complaint: string,
  opts: Parameters<typeof routePatient>[1] & { patientLat?: number | null; patientLng?: number | null } = {},
): Promise<RoutedMatch> {
  const { patientLat = null, patientLng = null, ...routeOpts } = opts;
  const outcome = await routePatient(complaint, routeOpts);

  let geoById = new Map<string, { latitude: number | null; longitude: number | null }>();
  if (outcome.doctors.length > 0) {
    const { data: geo } = await supabase
      .from('users')
      .select('id, latitude, longitude')
      .in(
        'id',
        outcome.doctors.map((d) => d.user_id),
      );
    geoById = new Map((geo ?? []).map((g: any) => [g.id, g]));
  }

  const ranked: RankedDoctor[] = outcome.doctors
    .map((d) => {
      const g = geoById.get(d.user_id);
      const distanceKm =
        patientLat != null && patientLng != null && g?.latitude != null && g?.longitude != null
          ? haversineKm(patientLat, patientLng, g.latitude, g.longitude)
          : null;
      const loadRatio = d.weekly_capacity > 0 ? d.current_load / d.weekly_capacity : 0;
      return { ...d, distanceKm, loadRatio };
    })
    // Nearest wins when the gap is meaningful (>2km); otherwise the less-busy
    // doctor wins — keeps a slightly-farther-but-free doctor from losing to a
    // marginally-closer, fully-booked one.
    .sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null && Math.abs(a.distanceKm - b.distanceKm) > 2) {
        return a.distanceKm - b.distanceKm;
      }
      return a.loadRatio - b.loadRatio;
    });

  return { ...outcome, ranked, best: ranked[0] ?? null };
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

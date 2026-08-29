import { supabase } from "../../lib/supabaseClient";

export interface VitalsRecord {
  systolic?: number | null;
  diastolic?: number | null;
  heartRate?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  glucose?: number | null;
  sourceLang?: string;
  rawTranscript?: string;
}

export async function saveVitalsCheckIn(patientId: string, record: VitalsRecord) {
  const { error } = await supabase.from("vitals_logs").insert({
    patient_id: patientId,
    systolic_mmhg: record.systolic ?? null,
    diastolic_mmhg: record.diastolic ?? null,
    heart_rate_bpm: record.heartRate ?? null,
    temperature_c: record.temperature ?? null,
    spo2_pct: record.spo2 ?? null,
    glucose_mgdl: record.glucose ?? null,
    source_lang: record.sourceLang ?? null,
    raw_transcript: record.rawTranscript ?? null,
  });
  if (error) throw error;
}

export interface VitalsRow {
  id: string;
  recorded_at: string;
  log_date: string;
  systolic_mmhg: number | null;
  diastolic_mmhg: number | null;
  heart_rate_bpm: number | null;
  temperature_c: number | null;
  spo2_pct: number | null;
  glucose_mgdl: number | null;
}

// Logs auto-delete server-side after 15 days (pg_cron), so this window is
// really just "everything that still exists" — but capping it here too
// keeps the query cheap and the chart's x-axis predictable even the moment
// after a purge runs.
export async function fetchRecentVitals(patientId: string, days = 15): Promise<VitalsRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("vitals_logs")
    .select("id, recorded_at, log_date, systolic_mmhg, diastolic_mmhg, heart_rate_bpm, temperature_c, spo2_pct, glucose_mgdl")
    .eq("patient_id", patientId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

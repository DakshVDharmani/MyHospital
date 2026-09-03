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

function localDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Add at most one reminder today when the patient has not logged vitals. */
export async function ensureDailyVitalsReminder(patientId: string, rows: VitalsRow[]): Promise<void> {
  const today = new Date();
  const logDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (rows.some((row) => row.log_date === logDate)) return;

  const { start, end } = localDayBounds(today);
  // The 06:00 IST cron may already have posted a `vitals_daily_reminder`
  // today — treat either kind as "already nudged" so we don't double up
  // (and don't fire a second SMS).
  const { data, error: lookupError } = await supabase
    .from("notifications")
    .select("notif_id")
    .eq("id", patientId)
    .in("type", ["vitals_missing", "vitals_daily_reminder"])
    .gte("created_at", start)
    .lt("created_at", end)
    .limit(1);
  if (lookupError) throw lookupError;
  if (data && data.length > 0) return;

  const { error } = await supabase.from("notifications").insert({
    id: patientId,
    urgency: 2,
    title: "Log today's vitals",
    message: "Your vitals have not been entered today. Please complete your daily check-in.",
    type: "vitals_missing",
    link: "/patient/vitals",
    metadata: { log_date: logDate },
  });
  if (error) throw error;
}

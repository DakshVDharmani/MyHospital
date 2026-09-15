import { supabase } from './supabaseClient';

// Builds a compact, plain-text summary of ONE patient's own records for the
// "Ask your care team" assistant to ground its answers in. Every query below
// is scoped by RLS to rows where patient_id/user_id = auth.uid(), so this
// can only ever pull the signed-in patient's own data — there is no path
// here that could return another patient's records.

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'unknown date';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function patientProfileSection(patientId: string): Promise<string> {
  const { data } = await supabase
    .from('patients')
    .select('blood_type, allergies, chronic_conditions, current_medications, distress_symptoms, distress_notes, distress_severity')
    .eq('user_id', patientId)
    .maybeSingle();
  if (!data) return '';
  const lines = [
    data.blood_type && `Blood type: ${data.blood_type}`,
    data.allergies?.length && `Allergies: ${data.allergies.join(', ')}`,
    data.chronic_conditions?.length && `Chronic conditions: ${data.chronic_conditions.join(', ')}`,
    data.current_medications?.length && `Current medications: ${data.current_medications.join(', ')}`,
    data.distress_symptoms?.length && `Recently reported symptoms: ${data.distress_symptoms.join(', ')}${data.distress_severity ? ` (severity: ${data.distress_severity})` : ''}`,
    data.distress_notes && `Symptom notes: ${data.distress_notes}`,
  ].filter(Boolean);
  return lines.length ? `PATIENT PROFILE:\n${lines.join('\n')}` : '';
}

async function vitalsSection(patientId: string): Promise<string> {
  const { data } = await supabase
    .from('vitals_logs')
    .select('recorded_at, systolic_mmhg, diastolic_mmhg, heart_rate_bpm, temperature_c, spo2_pct, glucose_mgdl')
    .eq('patient_id', patientId)
    .order('recorded_at', { ascending: false })
    .limit(15);
  if (!data?.length) return '';
  const lines = data.map((r) => {
    const parts = [
      r.systolic_mmhg != null && r.diastolic_mmhg != null && `BP ${r.systolic_mmhg}/${r.diastolic_mmhg} mmHg`,
      r.heart_rate_bpm != null && `HR ${r.heart_rate_bpm} bpm`,
      r.temperature_c != null && `Temp ${r.temperature_c}°C`,
      r.spo2_pct != null && `SpO2 ${r.spo2_pct}%`,
      r.glucose_mgdl != null && `Glucose ${r.glucose_mgdl} mg/dL`,
    ].filter(Boolean);
    return `- ${fmtDate(r.recorded_at)}: ${parts.join(', ')}`;
  });
  return `RECENT VITALS (most recent first):\n${lines.join('\n')}`;
}

async function appointmentsSection(patientId: string): Promise<string> {
  const { data } = await supabase
    .from('appointments')
    .select('title, reason, status, scheduled_at, doctor_name, mode')
    .eq('patient_id', patientId)
    .order('scheduled_at', { ascending: false })
    .limit(10);
  if (!data?.length) return '';
  const lines = data.map(
    (a) => `- ${fmtDate(a.scheduled_at)}: ${a.title || 'Appointment'} with ${a.doctor_name || 'a doctor'} (${a.status}${a.mode ? `, ${a.mode}` : ''})${a.reason ? ` — reason: ${a.reason}` : ''}`
  );
  return `APPOINTMENTS (most recent first):\n${lines.join('\n')}`;
}

async function consultationsSection(patientId: string): Promise<string> {
  const { data } = await supabase
    .from('consultation_records')
    .select('title, reason, started_at, doctor_name, summary_text')
    .eq('patient_id', patientId)
    .order('started_at', { ascending: false })
    .limit(8);
  if (!data?.length) return '';
  const lines = data.map((c) => {
    const summary = c.summary_text ? ` Summary: ${c.summary_text.slice(0, 600)}` : '';
    return `- ${fmtDate(c.started_at)}: ${c.title || 'Consultation'} with ${c.doctor_name || 'a doctor'}${c.reason ? ` — reason: ${c.reason}.` : '.'}${summary}`;
  });
  return `PAST CONSULTATIONS (most recent first):\n${lines.join('\n')}`;
}

async function triageSection(patientId: string): Promise<string> {
  const { data } = await supabase
    .from('triage_assessments')
    .select('complaint_text, specialty, risk_score, esi_label, need_bracket, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(8);
  if (!data?.length) return '';
  const lines = data.map(
    (t) => `- ${fmtDate(t.created_at)}: complaint "${t.complaint_text}" → routed to ${t.specialty}, risk score ${t.risk_score}${t.esi_label ? ` (${t.esi_label})` : ''}`
  );
  return `PAST TRIAGE / RISK ASSESSMENTS (most recent first):\n${lines.join('\n')}`;
}

/** Fetches this patient's own records (RLS-scoped) and formats them into one
 * text blob the assistant can ground its answers in. Sections that come back
 * empty (nothing logged yet) are simply omitted. */
export async function fetchPatientContext(patientId: string): Promise<string> {
  const sections = await Promise.all([
    patientProfileSection(patientId),
    vitalsSection(patientId),
    appointmentsSection(patientId),
    consultationsSection(patientId),
    triageSection(patientId),
  ]);
  const nonEmpty = sections.filter(Boolean);
  return nonEmpty.length ? nonEmpty.join('\n\n') : 'No records on file for this patient yet.';
}

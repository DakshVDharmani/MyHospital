import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';

/* ============================================================================
 *  Consultation records — the full record of a doctor <-> patient video visit.
 *
 *  `transcript`   : the complete meeting as plain text, one line per utterance
 *                   ("HH:MM  Speaker: ...") — captured live in the call.
 *  `summary`      : an AI-structured clinical summary + the doctor's advice,
 *                   produced by the `summarize-consultation` edge function.
 *  Surfaced on the patient's Medical Records page; downloadable as .txt / .pdf.
 * ==========================================================================*/

export type ConsultationStatus = 'draft' | 'final';
export type SummaryStatus = 'pending' | 'ready' | 'failed' | 'skipped';

export interface Medication {
  name: string;
  dose: string;
  instructions: string;
}

export interface ConsultationSummary {
  reason: string;
  history: string;
  examination: string;
  assessment: string;
  advice: string[];
  medications: Medication[];
  followUp: string;
  redFlags: string[];
  patientSummary: string;
}

export const EMPTY_SUMMARY: ConsultationSummary = {
  reason: '',
  history: '',
  examination: '',
  assessment: '',
  advice: [],
  medications: [],
  followUp: '',
  redFlags: [],
  patientSummary: '',
};

export interface ConsultationRecord {
  id: string;
  appointmentId: string | null;
  doctorId: string;
  patientId: string;
  doctorName: string;
  patientName: string;
  title: string;
  reason: string;
  startedAt: string | null;
  endedAt: string | null;
  transcript: string;
  summary: ConsultationSummary;
  summaryText: string;
  status: ConsultationStatus;
  summaryStatus: SummaryStatus;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  appointment_id: string | null;
  doctor_id: string;
  patient_id: string;
  doctor_name: string | null;
  patient_name: string | null;
  title: string | null;
  reason: string | null;
  started_at: string | null;
  ended_at: string | null;
  transcript: string | null;
  summary: Partial<ConsultationSummary> | null;
  summary_text: string | null;
  status: ConsultationStatus;
  summary_status: SummaryStatus;
  created_at: string;
  updated_at: string;
};

const COLS =
  'id, appointment_id, doctor_id, patient_id, doctor_name, patient_name, title, reason, ' +
  'started_at, ended_at, transcript, summary, summary_text, status, summary_status, ' +
  'created_at, updated_at';

function fromRow(r: Row): ConsultationRecord {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    doctorId: r.doctor_id,
    patientId: r.patient_id,
    doctorName: r.doctor_name ?? '',
    patientName: r.patient_name ?? '',
    title: r.title ?? 'Consultation',
    reason: r.reason ?? '',
    startedAt: r.started_at,
    endedAt: r.ended_at,
    transcript: r.transcript ?? '',
    summary: { ...EMPTY_SUMMARY, ...(r.summary ?? {}) },
    summaryText: r.summary_text ?? '',
    status: r.status,
    summaryStatus: r.summary_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('You are not signed in.');
  return data.user.id;
}

const KEY = ['consultation-records'] as const;

/** Every consultation record the signed-in user is a party to, newest first. */
export function useConsultationRecords() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ConsultationRecord[]> => {
      const { data, error } = await supabase
        .from('consultation_records')
        .select(COLS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Row[]).map(fromRow);
    },
  });
}

/** Keeps the list fresh as summaries land and the doctor finalises. */
export function useConsultationRecordsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel('consultation-records-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consultation_records' },
        () => qc.invalidateQueries({ queryKey: KEY }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);
}

export async function fetchConsultationRecord(id: string): Promise<ConsultationRecord | null> {
  const { data, error } = await supabase
    .from('consultation_records')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as unknown as Row) : null;
}

export interface NewConsultationRecord {
  appointmentId?: string | null;
  patientId: string;
  doctorName?: string;
  patientName?: string;
  title?: string;
  reason?: string;
  startedAt?: string | null;
  endedAt?: string | null;
  transcript: string;
}

/** Doctor → save the meeting the moment the call ends (summary lands after). */
export async function createConsultationRecord(
  body: NewConsultationRecord,
): Promise<ConsultationRecord> {
  const me = await uid();
  const { data, error } = await supabase
    .from('consultation_records')
    .insert({
      appointment_id: body.appointmentId ?? null,
      doctor_id: me,
      patient_id: body.patientId,
      doctor_name: body.doctorName ?? '',
      patient_name: body.patientName ?? '',
      title: body.title ?? 'Consultation',
      reason: body.reason ?? '',
      started_at: body.startedAt ?? null,
      ended_at: body.endedAt ?? null,
      transcript: body.transcript,
      summary_status: 'pending',
      status: 'draft',
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return fromRow(data as unknown as Row);
}

export type ConsultationPatch = Partial<{
  transcript: string;
  summary: ConsultationSummary;
  summaryText: string;
  summaryStatus: SummaryStatus;
  status: ConsultationStatus;
  title: string;
}>;

/** Doctor → edit the structured summary / finalise the record. */
export async function updateConsultationRecord(
  id: string,
  patch: ConsultationPatch,
): Promise<ConsultationRecord> {
  const row: Record<string, unknown> = {};
  if (patch.transcript !== undefined) row.transcript = patch.transcript;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.summaryText !== undefined) row.summary_text = patch.summaryText;
  if (patch.summaryStatus !== undefined) row.summary_status = patch.summaryStatus;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.title !== undefined) row.title = patch.title;

  const { data, error } = await supabase
    .from('consultation_records')
    .update(row)
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return fromRow(data as unknown as Row);
}

/**
 * Kicks the `summarize-consultation` edge function, which reads the record's
 * transcript, builds the structured summary with Claude, and writes it back.
 * Resolves to the resulting summary status; never throws for a "soft" failure
 * (the transcript is already safely saved either way).
 */
export async function summarizeConsultation(
  recordId: string,
): Promise<{ summaryStatus: SummaryStatus; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('summarize-consultation', {
      body: { recordId },
    });
    if (error) return { summaryStatus: 'failed', error: error.message };
    return {
      summaryStatus: (data?.summary_status as SummaryStatus) ?? 'failed',
      error: data?.error,
    };
  } catch (e) {
    return { summaryStatus: 'failed', error: (e as Error).message };
  }
}

/** Flat text rendering of a structured summary (mirrors the edge function). */
export function flattenSummary(s: ConsultationSummary): string {
  const lines: string[] = [];
  if (s.reason) lines.push(`Reason for visit: ${s.reason}`);
  if (s.history) lines.push(`History: ${s.history}`);
  if (s.examination) lines.push(`Examination / findings: ${s.examination}`);
  if (s.assessment) lines.push(`Assessment: ${s.assessment}`);
  if (s.advice.length) {
    lines.push("Doctor's advice:");
    s.advice.forEach((a) => lines.push(`  - ${a}`));
  }
  if (s.medications.length) {
    lines.push('Medications:');
    s.medications.forEach((m) =>
      lines.push(`  - ${[m.name, m.dose, m.instructions].filter(Boolean).join(' - ')}`),
    );
  }
  if (s.followUp) lines.push(`Follow-up: ${s.followUp}`);
  if (s.redFlags.length) {
    lines.push('Seek urgent care if:');
    s.redFlags.forEach((r) => lines.push(`  - ${r}`));
  }
  if (s.patientSummary) lines.push(`\nIn plain language: ${s.patientSummary}`);
  return lines.join('\n');
}

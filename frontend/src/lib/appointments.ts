import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';

/* ============================================================================
 *  Appointments — now backed directly by Supabase (`public.appointments`).
 *  The old standalone Mongo/Express service is no longer used.
 * ==========================================================================*/

export type ApptStatus =
  | 'requested'
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type ApptMode = 'in_person' | 'video';

export type ApptType =
  | 'general_consultation'
  | 'follow_up'
  | 'routine_checkup'
  | 'specialist_referral'
  | 'lab_review'
  | 'prescription_refill'
  | 'mental_health'
  | 'urgent_care'
  | 'vaccination'
  | 'physical_therapy';

export const APPT_TYPE_LABEL: Record<ApptType, string> = {
  general_consultation: 'General consultation',
  follow_up: 'Follow-up',
  routine_checkup: 'Routine check-up',
  specialist_referral: 'Specialist referral',
  lab_review: 'Lab results review',
  prescription_refill: 'Prescription refill',
  mental_health: 'Mental health',
  urgent_care: 'Urgent care',
  vaccination: 'Vaccination',
  physical_therapy: 'Physical therapy',
};

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  doctorName: string;
  patientName: string;
  title: string;
  reason: string;
  appointmentType: ApptType;
  start: string; // ISO — falls back to created_at when no slot is pinned yet
  end: string; // ISO
  scheduledAt: string | null; // the real value; null while only a window is given
  durationMinutes: number;
  mode: ApptMode;
  location: string;
  status: ApptStatus;
  requestedBy: 'patient' | 'doctor';
  preferredWindow: string;
  patientNote: string;
  notes: string; // doctor-only private note
  declineReason: string;
  meetingRoom: string;
  meetingStartedAt: string | null;
  meetingEndedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  doctor_id: string;
  patient_id: string;
  doctor_name: string;
  patient_name: string;
  title: string;
  reason: string;
  appointment_type: ApptType;
  scheduled_at: string | null;
  ends_at: string | null;
  duration_minutes: number;
  mode: ApptMode;
  location: string;
  status: ApptStatus;
  requested_by: 'patient' | 'doctor';
  preferred_window: string;
  patient_note: string;
  doctor_note: string;
  decline_reason: string;
  meeting_room: string;
  meeting_started_at: string | null;
  meeting_ended_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLS =
  'id, doctor_id, patient_id, doctor_name, patient_name, title, reason, appointment_type, ' +
  'scheduled_at, ends_at, duration_minutes, mode, location, status, requested_by, ' +
  'preferred_window, patient_note, doctor_note, decline_reason, meeting_room, ' +
  'meeting_started_at, meeting_ended_at, created_at, updated_at';

function fromRow(r: Row): Appointment {
  const start = r.scheduled_at ?? r.created_at;
  const end =
    r.ends_at ??
    new Date(new Date(start).getTime() + (r.duration_minutes || 30) * 60_000).toISOString();
  return {
    id: r.id,
    doctorId: r.doctor_id,
    patientId: r.patient_id,
    doctorName: r.doctor_name,
    patientName: r.patient_name,
    title: r.title,
    reason: r.reason,
    appointmentType: r.appointment_type,
    start,
    end,
    scheduledAt: r.scheduled_at,
    durationMinutes: r.duration_minutes,
    mode: r.mode,
    location: r.location,
    status: r.status,
    requestedBy: r.requested_by,
    preferredWindow: r.preferred_window,
    patientNote: r.patient_note,
    notes: r.doctor_note,
    declineReason: r.decline_reason,
    meetingRoom: r.meeting_room,
    meetingStartedAt: r.meeting_started_at,
    meetingEndedAt: r.meeting_ended_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('You are not signed in.');
  return data.user.id;
}

const KEY = ['appointments'] as const;

export function useAppointments() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Appointment[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(COLS)
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as unknown as Row[]).map(fromRow);
    },
  });
}

/** Keeps the appointments cache fresh from Postgres changes for the signed-in user. */
export function useAppointmentsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel('appointments-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => qc.invalidateQueries({ queryKey: KEY }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);
}

/** Patient → create a pending request. */
export function useRequestAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      doctorId: string;
      title: string;
      reason?: string;
      patientNote?: string;
      appointmentType?: ApptType;
      mode?: ApptMode;
      start?: string;
      preferredWindow?: string;
      durationMinutes?: number;
    }): Promise<Appointment> => {
      const me = await uid();
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          doctor_id: body.doctorId,
          patient_id: me,
          created_by: me,
          requested_by: 'patient',
          appointment_type: body.appointmentType ?? 'general_consultation',
          mode: body.mode ?? 'in_person',
          status: 'requested',
          title: body.title,
          reason: body.reason ?? '',
          patient_note: body.patientNote ?? '',
          preferred_window: body.preferredWindow ?? '',
          scheduled_at: body.start ?? null,
          duration_minutes: body.durationMinutes ?? 30,
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return fromRow(data as unknown as Row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Doctor → schedule directly (immediately confirmed). */
export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      patientId: string;
      title: string;
      reason?: string;
      appointmentType?: ApptType;
      mode?: ApptMode;
      start: string;
      end: string;
      location?: string;
    }): Promise<Appointment> => {
      const me = await uid();
      const minutes = Math.max(
        5,
        Math.round((+new Date(body.end) - +new Date(body.start)) / 60_000) || 30,
      );
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          doctor_id: me,
          patient_id: body.patientId,
          created_by: me,
          requested_by: 'doctor',
          appointment_type: body.appointmentType ?? 'general_consultation',
          mode: body.mode ?? 'in_person',
          status: 'confirmed',
          title: body.title,
          reason: body.reason ?? '',
          location: body.location ?? '',
          scheduled_at: body.start,
          ends_at: body.end,
          duration_minutes: minutes,
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return fromRow(data as unknown as Row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

type PatchBody = Partial<
  Pick<
    Appointment,
    | 'title'
    | 'reason'
    | 'mode'
    | 'location'
    | 'notes'
    | 'status'
    | 'start'
    | 'end'
    | 'appointmentType'
    | 'declineReason'
  >
>;

/** Doctor → confirm / reschedule / decline / annotate. Patient → cancel own pending request. */
export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & PatchBody): Promise<Appointment> => {
      const patch: Record<string, unknown> = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.reason !== undefined) patch.reason = body.reason;
      if (body.mode !== undefined) patch.mode = body.mode;
      if (body.location !== undefined) patch.location = body.location;
      if (body.notes !== undefined) patch.doctor_note = body.notes;
      if (body.appointmentType !== undefined) patch.appointment_type = body.appointmentType;
      if (body.declineReason !== undefined) patch.decline_reason = body.declineReason;
      if (body.start !== undefined) patch.scheduled_at = body.start;
      if (body.end !== undefined) patch.ends_at = body.end;
      if (body.status !== undefined) {
        patch.status = body.status;
        if (body.status === 'cancelled') patch.cancelled_by = await uid();
      }

      const { data, error } = await supabase
        .from('appointments')
        .update(patch)
        .eq('id', id)
        .select(COLS)
        .single();
      if (error) throw error;
      return fromRow(data as unknown as Row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Either party → cancel (patient only while still `requested`). */
export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Appointment> => {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled', cancelled_by: await uid() })
        .eq('id', id)
        .select(COLS)
        .single();
      if (error) throw error;
      return fromRow(data as unknown as Row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Loads a single appointment the caller is a party to (RLS enforces membership). */
export async function fetchAppointment(id: string): Promise<Appointment | null> {
  const { data, error } = await supabase.from('appointments').select(COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as unknown as Row) : null;
}

/** Marks the video room open (first joiner) — fires the "visit is live" notification. */
export async function markMeetingStarted(id: string): Promise<void> {
  const me = await uid();
  const { error } = await supabase
    .from('appointments')
    .update({ meeting_started_at: new Date().toISOString(), meeting_started_by: me })
    .eq('id', id)
    .is('meeting_started_at', null);
  if (error && error.code !== 'PGRST116') throw error;
}

/** Stamps the room as closed and, for a doctor, marks the visit completed. */
export async function markMeetingEnded(id: string, complete = false): Promise<void> {
  const patch: Record<string, unknown> = { meeting_ended_at: new Date().toISOString() };
  if (complete) patch.status = 'completed';
  const { error } = await supabase.from('appointments').update(patch).eq('id', id);
  if (error) throw error;
}

/* ---------------- Schedule-X datetime helpers ----------------
 * Schedule-X v2 uses local wall-clock strings: 'YYYY-MM-DD HH:mm'.
 * Postgres stores UTC ISO. Convert at the boundary.               */

const pad = (n: number) => String(n).padStart(2, '0');

export function isoToSx(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export function sxToIso(sx: string): string {
  const [date, time = '00:00'] = sx.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

/** 'YYYY-MM-DD' for Schedule-X `selectedDate`. */
export function isoToSxDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

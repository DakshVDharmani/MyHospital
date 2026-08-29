import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type ApptStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
export type ApptMode = 'in_person' | 'video';

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  doctorName: string;
  patientName: string;
  title: string;
  reason: string;
  start: string; // ISO
  end: string; // ISO
  mode: ApptMode;
  location: string;
  status: ApptStatus;
  requestedBy: 'patient' | 'doctor';
  preferredWindow: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = ['appointments'] as const;

export function useAppointments() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<Appointment[]>('/api/appointments'),
  });
}

/** Patient → create a pending request. */
export function useRequestAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      doctorId: string;
      doctorName?: string;
      title: string;
      reason?: string;
      mode?: ApptMode;
      start?: string;
      end?: string;
      preferredWindow?: string;
    }) => api<Appointment>('/api/appointments/request', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Doctor → schedule directly (confirmed). */
export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      patientId: string;
      patientName?: string;
      title: string;
      reason?: string;
      mode?: ApptMode;
      start: string;
      end: string;
      location?: string;
    }) => api<Appointment>('/api/appointments', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Doctor → confirm / reschedule / decline / annotate. */
export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<
      Pick<Appointment, 'title' | 'reason' | 'mode' | 'location' | 'notes' | 'status' | 'start' | 'end'>
    >) => api<Appointment>(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Either party → cancel (patient only while still `requested`). */
export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Appointment>(`/api/appointments/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/* ---------------- Schedule-X datetime helpers ----------------
 * Schedule-X v2 uses local wall-clock strings: 'YYYY-MM-DD HH:mm'.
 * Mongo stores UTC ISO. Convert at the boundary.                */

const pad = (n: number) => String(n).padStart(2, '0');

export function isoToSx(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

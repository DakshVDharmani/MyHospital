import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { PriorityLevel } from './priority';

/* ============================================================================
 *  Doctor patient panel — a live, priority-ordered queue.
 *
 *  Every triage assessment auto-routes its patient to a doctor and caches the
 *  urgency on `public.patients` (see the `triage_shift_patient` trigger). The
 *  `doctor_patient_panel()` RPC returns the signed-in doctor's patients already
 *  sorted critical → stable, so the screen never keeps a hand-maintained list.
 * ==========================================================================*/

export interface PanelPatient {
  patientId: string;
  name: string;
  age: number | null;
  condition: string;
  status: PriorityLevel;
  /** 0–100 urgency from the triage model. */
  priorityScore: number;
  lastVisit: string | null;
  nextAppt: string | null;
  nextApptMode: 'in_person' | 'video' | null;
  priorityUpdatedAt: string | null;
}

type Row = {
  patient_id: string;
  name: string;
  age: number | null;
  condition: string;
  bracket: string;
  priority_score: number | string;
  last_visit: string | null;
  next_appt: string | null;
  next_appt_mode: string | null;
  priority_updated_at: string | null;
};

const BRACKETS: PriorityLevel[] = ['critical', 'urgent', 'moderate', 'stable'];
const KEY = ['doctor-panel'] as const;

export function useDoctorPanel() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<PanelPatient[]> => {
      const { data, error } = await supabase.rpc('doctor_patient_panel');
      if (error) throw error;
      return (data as Row[]).map((r) => ({
        patientId: r.patient_id,
        name: r.name,
        age: r.age,
        condition: r.condition,
        status: (BRACKETS.includes(r.bracket as PriorityLevel) ? r.bracket : 'stable') as PriorityLevel,
        priorityScore: Math.round(Number(r.priority_score) || 0),
        lastVisit: r.last_visit,
        nextAppt: r.next_appt,
        nextApptMode: (r.next_appt_mode as PanelPatient['nextApptMode']) ?? null,
        priorityUpdatedAt: r.priority_updated_at,
      }));
    },
  });
}

/** Re-pulls the panel whenever a patient is re-prioritised or an appointment moves. */
export function useDoctorPanelRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel('doctor-panel-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients' },
        () => qc.invalidateQueries({ queryKey: KEY }),
      )
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

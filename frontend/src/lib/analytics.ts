import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

/** One labelled magnitude — the shape most panels consume. */
export interface Slice {
  label: string;
  value: number;
}

export interface AdminMetrics {
  generated_at: string;
  kpis: {
    patient_users: number;
    patient_records: number;
    doctors: number;
    doctors_active: number;
    doctors_leave: number;
    appts_total: number;
    appts_upcoming: number;
    appts_completed: number;
    triage_total: number;
    triage_high: number;
    avg_risk: number | null;
    vitals_logs: number;
    consultations: number;
    notif_total: number;
    notif_unread: number;
    avg_rating: number | null;
    avg_fee: number | null;
    capacity_util: number | null;
    messages: number;
    conversations: number;
    verified_pct: number | null;
    telemedicine_pct: number | null;
  };
  registrations: { d: string; iso: string; doctors: number; patients: number }[];
  appts_by_status: Slice[];
  appts_by_type: Slice[];
  appts_by_mode: Slice[];
  doctors_by_specialty: Slice[];
  doctors_by_state: Slice[];
  supply_demand: { label: string; doctors: number; demand: number }[];
  triage_need: Slice[];
  triage_esi: Slice[];
  triage_source: Slice[];
  risk_histogram: Slice[];
  patient_priority: Slice[];
  capacity_top: { name: string; specialty: string; load: number; capacity: number; pct: number }[];
  rating_dist: Slice[];
  experience_dist: Slice[];
  fee_by_specialty: Slice[];
  notif_by_type: Slice[];
  notif_by_urgency: Slice[];
  consult_funnel: {
    appointments: number;
    meetings: number;
    completed: number;
    recorded: number;
    summarized: number;
  };
  geo_points: { lat: number; lng: number; s: string }[];
  geo_states: { state: string; n: number; lat: number; lng: number }[];
  activity: { ts: string; kind: string; text: string }[];
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  const { data, error } = await supabase.rpc('admin_dashboard_metrics');
  if (error) throw new Error(error.message);
  return data as AdminMetrics;
}

export interface UseAdminMetrics {
  metrics: AdminMetrics | null;
  error: string | null;
  loading: boolean;      // first load only
  refreshing: boolean;   // a background refresh is in flight
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Live poll of the analytics feed. One RPC round-trip every `intervalMs`
 * (default 15s) plus an immediate refetch whenever the tab regains focus, so
 * the workspace tracks the database in near real time without a socket.
 */
export function useAdminMetrics(intervalMs = 15_000): UseAdminMetrics {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const next = await fetchAdminMetrics();
      setMetrics(next);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics.');
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, intervalMs);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load, intervalMs]);

  return { metrics, error, loading, refreshing, lastUpdated, refresh: load };
}

// ---- shared formatting helpers -------------------------------------------

export const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

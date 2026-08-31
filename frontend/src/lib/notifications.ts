import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import type { PriorityLevel } from './priority';

/* ============================================================================
 *  Service notifications — read feed for `public.notifications`.
 *
 *  Rows are written server-side by database triggers (appointment lifecycle,
 *  worsening vitals, new secure messages, meeting-started, welcome, …) and by
 *  the `run_appointment_reminders` cron job. The client only ever reads its
 *  own feed and marks rows read; it never inserts cross-user notifications.
 * ==========================================================================*/

/** `notifications.urgency` is a plain int2; map it onto the app's scale. */
export const URGENCY_LEVEL: Record<PriorityLevel, number> = {
  critical: 0,
  urgent: 1,
  moderate: 2,
  stable: 3,
};

export const URGENCY_META: Record<number, { level: PriorityLevel; label: string; color: string; bg: string }> = {
  0: { level: 'critical', label: 'Critical', color: '#d03b3b', bg: 'rgba(208, 59, 59, 0.12)' },
  1: { level: 'urgent', label: 'Urgent', color: '#ec835a', bg: 'rgba(236, 131, 90, 0.14)' },
  2: { level: 'moderate', label: 'Update', color: '#2C7FF2', bg: 'rgba(44, 127, 242, 0.12)' },
  3: { level: 'stable', label: 'Info', color: '#0ca30c', bg: 'rgba(12, 163, 12, 0.12)' },
};

export interface Notification {
  notifId: string;
  userId: string;
  type: string | null;
  urgency: number;
  title: string;
  message: string;
  link: string | null;
  metadata: Record<string, unknown>;
  actorId: string | null;
  readAt: string | null;
  createdAt: string;
}

type Row = {
  notif_id: string;
  id: string;
  type: string | null;
  urgency: number | null;
  title: string | null;
  message: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
};

const COLS = 'notif_id, id, type, urgency, title, message, link, metadata, actor_id, read_at, created_at';

function fromRow(r: Row): Notification {
  return {
    notifId: r.notif_id,
    userId: r.id,
    type: r.type,
    urgency: r.urgency ?? 2,
    title: r.title ?? '',
    message: r.message ?? '',
    link: r.link,
    metadata: r.metadata ?? {},
    actorId: r.actor_id,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

/** A user's notifications, most recent first. */
export async function fetchNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLS)
    .eq('id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function markNotificationRead(notifId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('notif_id', notifId)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', userId)
    .is('read_at', null);
  if (error) throw error;
}

/**
 * Live notification feed for the signed-in user: initial load + realtime
 * inserts/updates over the `notifications` table (added to `supabase_realtime`).
 */
export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    seen.current = new Set();

    (async () => {
      setLoading(true);
      try {
        const rows = await fetchNotifications(userId);
        if (cancelled) return;
        rows.forEach((r) => seen.current.add(r.notifId));
        setItems(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const ch = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `id=eq.${userId}` },
        (payload) => {
          const n = fromRow(payload.new as Row);
          if (seen.current.has(n.notifId)) return;
          seen.current.add(n.notifId);
          setItems((prev) => [n, ...prev].slice(0, 100));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `id=eq.${userId}` },
        (payload) => {
          const n = fromRow(payload.new as Row);
          setItems((prev) => prev.map((x) => (x.notifId === n.notifId ? n : x)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [userId]);

  const markRead = useCallback(async (notifId: string) => {
    setItems((prev) =>
      prev.map((x) => (x.notifId === notifId ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)),
    );
    try {
      await markNotificationRead(notifId);
    } catch {
      /* optimistic; realtime UPDATE will reconcile */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: now })));
    try {
      await markAllNotificationsRead(userId);
    } catch {
      /* optimistic */
    }
  }, [userId]);

  const unreadCount = items.reduce((n, x) => n + (x.readAt ? 0 : 1), 0);

  return { items, loading, unreadCount, markRead, markAllRead };
}

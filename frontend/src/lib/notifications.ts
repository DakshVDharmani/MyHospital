import { supabase } from './supabaseClient';
import type { PriorityLevel } from './priority';

export interface Notification {
  notifId: string;
  userId: string;
  urgency: number;
  title: string;
  message: string;
  createdAt: string;
}

// The `notifications` table stores urgency as a plain int2, not an enum.
// This maps it onto the same scale used everywhere else in the app
// (see priority.ts) so callers can pass a PriorityLevel instead of a magic number.
export const URGENCY_LEVEL: Record<PriorityLevel, number> = {
  critical: 0,
  urgent: 1,
  moderate: 2,
  stable: 3,
};

export interface CreateNotificationInput {
  /** Recipient's user id (public.users.id / auth.uid()). */
  userId: string;
  title: string;
  message: string;
  urgency: PriorityLevel | number;
}

/**
 * Persists a notification for a user.
 *
 * This only stores the row — nothing calls this yet. The actual triggers
 * (e.g. a critical vitals reading, a new secure-chat message) get wired up
 * separately once that logic exists.
 *
 * Note: RLS currently only allows a user to insert a notification for
 * themself (`auth.uid() = userId`). Notifying a *different* user (e.g. a
 * patient's vitals alerting their doctor) will need a privileged, service-role
 * insert path — not yet in place.
 */
export async function createNotification({ userId, title, message, urgency }: CreateNotificationInput): Promise<Notification> {
  const urgencyValue = typeof urgency === 'number' ? urgency : URGENCY_LEVEL[urgency];

  const { data, error } = await supabase
    .from('notifications')
    .insert({ id: userId, title, message, urgency: urgencyValue })
    .select('notif_id, id, urgency, title, message, created_at')
    .single();
  if (error) throw error;

  return fromRow(data);
}

/** Loads a user's notifications, most recent first. */
export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('notif_id, id, urgency, title, message, created_at')
    .eq('id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map(fromRow);
}

function fromRow(row: {
  notif_id: string;
  id: string;
  urgency: number;
  title: string;
  message: string;
  created_at: string;
}): Notification {
  return {
    notifId: row.notif_id,
    userId: row.id,
    urgency: row.urgency,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
  };
}

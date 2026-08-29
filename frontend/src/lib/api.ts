import { supabase } from './supabaseClient';

/** Base URL of the Express + Mongoose API. Override per-env with VITE_API_URL. */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8787';

/**
 * fetch() wrapper that attaches the current Supabase access token so the
 * backend can verify who is calling and enforce doctor/patient rules.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

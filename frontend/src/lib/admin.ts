// The admin auth routes (/api/admin/*) are mounted in backend/server.js, which
// runs on PORT (8787) — NOT the appointments process on APPT_PORT (8788) that
// VITE_API_URL points at. Prefer an explicit override, then the server.js base,
// and only fall back to VITE_API_URL for older setups.
const ADMIN_API_BASE = (
  (import.meta.env.VITE_ADMIN_API_URL as string | undefined) ??
  (import.meta.env.VITE_VOICE_BACKEND_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8787'
).replace(/\/$/, '');

export type AdminSession = { authenticated: true; username: string };

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ADMIN_API_BASE}/api/admin${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || 'Admin authentication failed.');
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function loginAdmin(username: string, password: string) {
  return adminRequest<AdminSession>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getAdminSession() {
  return adminRequest<AdminSession>('/session');
}

export function logoutAdmin() {
  return adminRequest<void>('/logout', { method: 'POST' });
}

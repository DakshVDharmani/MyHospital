/**
 * Authenticates a request using the Supabase access token sent as
 * `Authorization: Bearer <jwt>`.
 *
 * Rather than verifying the JWT signature locally (which needs the project's
 * JWT secret), we ask Supabase Auth to validate it via GET /auth/v1/user.
 * Results are cached briefly so this costs one extra call per token, not per
 * request. Only SUPABASE_URL + SUPABASE_ANON_KEY are needed — both are public.
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // token -> { user, exp }

async function resolveUser(token) {
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const u = await res.json();
  const meta = u.user_metadata || {};
  const user = {
    id: u.id,
    email: u.email || meta.email || "",
    name: meta.name || meta.full_name || u.email || "",
    role: meta.role || u.app_metadata?.role || null, // 'doctor' | 'patient' | null
  };
  cache.set(token, { user, exp: Date.now() + CACHE_TTL_MS });
  return user;
}

async function requireAuth(req, res, next) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: "SUPABASE_URL / SUPABASE_ANON_KEY not configured" });
  }
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const user = await resolveUser(token);
    if (!user?.id) return res.status(401).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  } catch (e) {
    console.error("auth check failed:", e.message);
    res.status(503).json({ error: "Auth verification unavailable" });
  }
}

/** Gate a route to a single app role. */
function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: `This action requires the ${role} role` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

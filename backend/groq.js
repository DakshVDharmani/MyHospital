// Shared fetch helper for Groq's hosted Whisper API (OpenAI-compatible).
// Requires Node 18+ (uses global fetch/FormData/Blob).
const { GROQ_BASE, GROQ_API_KEY } = require("./config");

async function groqFetch(path, options = {}) {
  if (!GROQ_API_KEY) {
    const err = new Error(
      "GROQ_API_KEY is not set. Get a free key from https://console.groq.com/keys and add it to server/.env"
    );
    err.status = 500;
    throw err;
  }

  const { body, method = "POST" } = options;
  const res = await fetch(`${GROQ_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.error || `Groq ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = { groqFetch };

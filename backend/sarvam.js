// Shared fetch helper for Sarvam AI API.
// Requires Node 18+ (uses global fetch/FormData/Blob).
const { SARVAM_BASE, SARVAM_API_KEY } = require("./config");

async function sarvaFetch(path, options = {}) {
  if (!SARVAM_API_KEY) {
    const err = new Error(
      "SARVAM_API_KEY is not set. Copy server/.env.example to server/.env and add your free key from https://dashboard.sarvam.ai"
    );
    err.status = 500;
    throw err;
  }

  const { body, method = "GET", headers } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${SARVAM_BASE}${path}`, {
    method,
    headers: {
      "api-subscription-key": SARVAM_API_KEY,
      // Let fetch set the multipart boundary for FormData; JSON otherwise.
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: isForm ? body : JSON.stringify(body),
  });

  // Sarvam's REST endpoints always reply with JSON (audio comes back as
  // base64 strings inside the JSON body, not as raw audio bytes).
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      data?.error?.message || data?.message || data?.error || `Sarvam ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = { sarvaFetch };
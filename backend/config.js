require("dotenv").config();

// ------------------------------------------------------------------
//  Supported Indian languages + their Sarvam voice model codes.
//
//  Speaker names below are real Bulbul v2 voices (verified against
//  Sarvam's current API docs, Aug 2026):
//    Female: anushka, manisha, vidya, arya
//    Male:   abhilash, karun, hitesh
//  (Bulbul v3 has a larger 30+ voice catalog with different names,
//  e.g. "shubh", "ritu" — if you upgrade TTS_MODEL to bulbul:v3,
//  update these speakers to match.)
// ------------------------------------------------------------------
const TTS_MODEL = process.env.SARVAM_TTS_MODEL || "bulbul:v3";
const STT_MODEL = process.env.SARVAM_STT_MODEL || "saaras:v3";
const CHAT_MODEL = process.env.SARVAM_CHAT_MODEL || "sarvam-105b";

// Groq's hosted Whisper — free tier, no local CPU cost, and not blocked in
// Brave (unlike the browser's built-in SpeechRecognition, which depends on a
// Google API key Brave strips out). Used for STT only; chat replies still go
// through Sarvam so responses stay multilingual.
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

const LANGS = {
  hi:  { name: "Hindi",     code: "hi-IN", speaker: "ritu" },
  en:  { name: "English",   code: "en-IN", speaker: "shubh" },
  ta:  { name: "Tamil",     code: "ta-IN", speaker: "kavitha" },
  te:  { name: "Telugu",    code: "te-IN", speaker: "priya" },
  bn:  { name: "Bengali",   code: "bn-IN", speaker: "simran" },
  ml:  { name: "Malayalam", code: "ml-IN", speaker: "roopa" },
  kn:  { name: "Kannada",   code: "kn-IN", speaker: "kavya" },
  mr:  { name: "Marathi",   code: "mr-IN", speaker: "shreya" },
  gu:  { name: "Gujarati",  code: "gu-IN", speaker: "aditya" },
};

const DEFAULT_LANG = (process.env.DEFAULT_LANG || "hi").toLowerCase();

function getLang(code) {
  return LANGS[code?.toLowerCase()] || LANGS[DEFAULT_LANG];
}

module.exports = {
  LANGS,
  DEFAULT_LANG,
  getLang,
  TTS_MODEL,
  STT_MODEL,
  CHAT_MODEL,
  SARVAM_BASE: "https://api.sarvam.ai",
  SARVAM_API_KEY: process.env.SARVAM_API_KEY,
  GROQ_BASE: "https://api.groq.com/openai/v1",
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_STT_MODEL,
  RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || "",
  RAG_TIMEOUT_MS: parseInt(process.env.RAG_TIMEOUT_MS || "5000", 10),
  PORT: process.env.PORT || 8787,
  FREE_DAILY_LIMIT: parseInt(process.env.FREE_DAILY_LIMIT || "25", 10),
};

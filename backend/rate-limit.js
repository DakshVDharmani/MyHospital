// Simple in-memory daily rate limiter keyed by client IP.
// Keeps the assistant "absolutely free" for limited daily use.
const { FREE_DAILY_LIMIT } = require("./config");

const buckets = new Map(); // ip -> { date: 'YYYY-MM-DD', count: number }

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function usage(ip) {
  const key = dayKey();
  const entry = buckets.get(ip);
  if (!entry || entry.date !== key) {
    return { remaining: FREE_DAILY_LIMIT, resetDay: key };
  }
  return { remaining: Math.max(0, FREE_DAILY_LIMIT - entry.count), resetDay: key };
}

function consume(ip) {
  const key = dayKey();
  let entry = buckets.get(ip);
  if (!entry || entry.date !== key) {
    entry = { date: key, count: 0 };
    buckets.set(ip, entry);
  }
  if (entry.count >= FREE_DAILY_LIMIT) return false;
  entry.count += 1;
  return true;
}

function rateLimit(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  if (!consume(ip)) {
    return res.status(429).json({
      error: "Free daily limit reached. Come back tomorrow or add your own Sarvam API key.",
      usage: usage(ip),
    });
  }
  req._usage = usage(ip);
  next();
}

module.exports = { rateLimit, usage, FREE_DAILY_LIMIT };

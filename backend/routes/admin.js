const crypto = require("crypto");
const express = require("express");

const router = express.Router();
const COOKIE_NAME = "mh_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;
const PROCESS_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(48).toString("hex");

function configuredUsername() {
  return process.env.ADMIN_USERNAME || "MyHospitalAdmin";
}

function configuredPassword() {
  return process.env.ADMIN_PASSWORD || "abcX\\@123";
}

function signingSecret() {
  return PROCESS_SESSION_SECRET;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sign(value) {
  return crypto.createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function createSession(username) {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + SESSION_SECONDS * 1000 }))
    .toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return [name, decodeURIComponent(value.join("="))];
  }).filter(([name]) => name));
}

function readSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_SECONDS * 1000,
    path: "/",
  };
}

router.post("/login", (req, res) => {
  const { username = "", password = "" } = req.body || {};
  if (!safeEqual(username, configuredUsername()) || !safeEqual(password, configuredPassword())) {
    return res.status(401).json({ error: "Incorrect admin name or password." });
  }

  res.cookie(COOKIE_NAME, createSession(configuredUsername()), cookieOptions());
  res.json({ authenticated: true, username: configuredUsername() });
});

router.get("/session", (req, res) => {
  const session = readSession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, username: session.username });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});

module.exports = router;

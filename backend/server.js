const express = require("express");
const cors = require("cors");
const { PORT, LANGS } = require("./config");
const { usage } = require("./rate-limit");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// Routes (backend only — keeps all AI/voice logic & keys server-side)
app.use("/api/tts", require("./routes/tts"));
app.use("/api/stt", require("./routes/stt"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/admin", require("./routes/admin"));

// Free-tier usage + supported languages
app.get("/api/health", (req, res) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  res.json({
    ok: true,
    service: "VoiceAsst backend",
    languages: Object.entries(LANGS).map(([code, l]) => ({ code, name: l.name })),
    usage: usage(ip),
  });
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n  VoiceAsst backend running → http://localhost:${PORT}`);
  console.log(`  Health check        → http://localhost:${PORT}/api/health\n`);
});

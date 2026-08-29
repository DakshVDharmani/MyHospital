/**
 * Standalone Appointments API — MongoDB (Mongoose) + Supabase-token auth.
 *
 * Runs as its OWN process on its OWN port (APPT_PORT, default 8788) so it is
 * fully independent of the voice-assistant server (server.js on PORT 8787):
 * restart, crash, or deploy this without touching voice.
 *
 *   npm run appt        # node appointments-server.js
 *   npm run appt:dev    # node --watch appointments-server.js
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectMongo } = require("./db");

const app = express();

// CORS: open by default; set CORS_ORIGIN to a comma-separated allow-list in prod
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) =>
  res.json({ ok: true, service: "MyHospital appointments API" }),
);
app.use("/api/appointments", require("./routes/appointments"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const APPT_PORT = process.env.APPT_PORT || 8788;

connectMongo().catch((e) => console.error("  ✖  MongoDB connection failed:", e.message));

app.listen(APPT_PORT, () => {
  console.log(`\n  MyHospital appointments API → http://localhost:${APPT_PORT}`);
  console.log(`  Health check                → http://localhost:${APPT_PORT}/health\n`);
});

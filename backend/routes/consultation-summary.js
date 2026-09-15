const { Router } = require("express");
const { CHAT_MODEL } = require("../config");
const { sarvaFetch } = require("../sarvam");
const { rateLimit } = require("../rate-limit");

const router = Router();

const EMPTY_SUMMARY = {
  reason: "",
  history: "",
  examination: "",
  assessment: "",
  advice: [],
  medications: [],
  followUp: "",
  redFlags: [],
  patientSummary: "",
};

const SYSTEM_PROMPT = `You are a clinical scribe. You are given the plain-text transcript of a doctor-patient video consultation ("HH:MM  Speaker: line" per line). Produce a structured clinical summary as JSON only, no prose outside the JSON, matching exactly this shape:
{
  "reason": string,        // reason for the visit, one line
  "history": string,       // relevant history mentioned
  "examination": string,   // exam/findings discussed, if any
  "assessment": string,    // the doctor's assessment/diagnosis
  "advice": string[],      // doctor's advice, one item per line
  "medications": [{"name": string, "dose": string, "instructions": string}],
  "followUp": string,      // follow-up plan, if any
  "redFlags": string[],    // symptoms that should prompt urgent care
  "patientSummary": string // 2-3 plain-language sentences for the patient
}
Use only what was actually said in the transcript. Leave a field as an empty string/array if it was not discussed. Never invent medications, diagnoses, or advice that isn't in the transcript. Output valid JSON and nothing else.`;

function flattenSummary(s) {
  const lines = [];
  if (s.reason) lines.push(`Reason for visit: ${s.reason}`);
  if (s.history) lines.push(`History: ${s.history}`);
  if (s.examination) lines.push(`Examination / findings: ${s.examination}`);
  if (s.assessment) lines.push(`Assessment: ${s.assessment}`);
  if (s.advice?.length) {
    lines.push("Doctor's advice:");
    s.advice.forEach((a) => lines.push(`  - ${a}`));
  }
  if (s.medications?.length) {
    lines.push("Medications:");
    s.medications.forEach((m) => lines.push(`  - ${[m.name, m.dose, m.instructions].filter(Boolean).join(" - ")}`));
  }
  if (s.followUp) lines.push(`Follow-up: ${s.followUp}`);
  if (s.redFlags?.length) {
    lines.push("Seek urgent care if:");
    s.redFlags.forEach((r) => lines.push(`  - ${r}`));
  }
  if (s.patientSummary) lines.push(`\nIn plain language: ${s.patientSummary}`);
  return lines.join("\n");
}

// POST /api/consultation-summary : turns a saved call transcript into a
// structured clinical summary via the same Sarvam chat model used for the
// voice assistant. body: { transcript: string }
router.post("/", rateLimit, async (req, res) => {
  try {
    const { transcript } = req.body || {};
    if (typeof transcript !== "string" || !transcript.trim()) {
      return res.status(400).json({ error: "transcript is required" });
    }

    const spokenLines = transcript.split("\n").filter((l) => l.trim()).length;
    if (spokenLines < 3) {
      return res.json({ summary_status: "skipped" });
    }

    const out = await sarvaFetch("/v1/chat/completions", {
      method: "POST",
      body: {
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: transcript.slice(0, 12000) },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        reasoning_effort: null,
        response_format: { type: "json_object" },
      },
    });

    const raw = out.choices?.[0]?.message?.content?.trim() || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!parsed) {
      return res.json({ summary_status: "failed", error: "Could not parse the model's summary." });
    }

    const summary = { ...EMPTY_SUMMARY, ...parsed };
    res.json({ summary_status: "ready", summary, summary_text: flattenSummary(summary) });
  } catch (err) {
    console.error("Consultation summary error:", err.message);
    res.status(err.status || 500).json({ error: err.message, summary_status: "failed" });
  }
});

module.exports = router;

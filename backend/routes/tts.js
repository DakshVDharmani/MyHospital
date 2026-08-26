const { Router } = require("express");
const { getLang, TTS_MODEL } = require("../config");
const { sarvaFetch } = require("../sarvam");
const { rateLimit } = require("../rate-limit");

const router = Router();

// POST /api/tts : get the assistant's own voice audio for some text
// body: { text: string, lang?: 'hi'|'ta'|..., speaker?: string, pitch? }
router.post("/", rateLimit, async (req, res) => {
  try {
    const { text: rawText, lang: langCode, speaker, pitch = 0 } = req.body || {};
    if (!rawText) return res.status(400).json({ error: "text is required" });

    const lang = getLang(langCode);
    const speakerName = speaker || lang.speaker;

    // bulbul:v2 caps input at 1500 chars. Rather than fail with 400 and go
    // silent, trim to the last full sentence that fits so we always speak
    // *something* back.
    const MAX_CHARS = 1450;
    let text = rawText;
    if (text.length > MAX_CHARS) {
      const cut = text.slice(0, MAX_CHARS);
      const lastBreak = Math.max(
        cut.lastIndexOf("।"), // Devanagari danda
        cut.lastIndexOf("."),
        cut.lastIndexOf("!"),
        cut.lastIndexOf("?")
      );
      text = lastBreak > 200 ? cut.slice(0, lastBreak + 1) : cut;
    }

    // POST /text-to-speech returns JSON: { request_id, audios: [base64Wav] }
    const out = await sarvaFetch("/text-to-speech", {
      method: "POST",
      body: {
        text,
        language_code: lang.code,
        speaker: speakerName,
        model: TTS_MODEL,
        speech_sample_rate: 16000,
        // pitch/loudness/enable_preprocessing are bulbul:v2-only params
        pitch: pitch !== 0 ? pitch : undefined,
      },
    });

    const base64Audio = out.audios?.[0];
    if (!base64Audio) throw new Error("Sarvam TTS returned no audio");
    const buffer = Buffer.from(base64Audio, "base64");

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("X-Speaker", speakerName);
    res.setHeader("X-Lang", lang.code);
    res.send(buffer);
  } catch (err) {
    console.error("TTS error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
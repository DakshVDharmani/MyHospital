const { Router } = require("express");
const multer = require("multer");
const { getLang, GROQ_STT_MODEL } = require("../config");
const { groqFetch } = require("../groq");
const { rateLimit } = require("../rate-limit");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Whisper's detected-language names -> this app's short language codes.
const WHISPER_LANG_TO_CODE = {
  english: "en",
  hindi: "hi",
  tamil: "ta",
  telugu: "te",
  bengali: "bn",
  malayalam: "ml",
  kannada: "kn",
  marathi: "mr",
  gujarati: "gu",
};

// POST /api/stt : transcribe an uploaded audio file via Groq's free, hosted
// Whisper endpoint. No `language` is sent to the model, so it auto-detects
// from the audio itself — the client never has to pick a language up front.
// body: multipart form-data  file=<audio>&language_code=hi-IN (hint only, used as a fallback)
router.post("/", rateLimit, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const fallbackLang = getLang(req.body?.language_code);
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || "audio.webm");
    form.append("model", GROQ_STT_MODEL);
    form.append("response_format", "verbose_json"); // includes detected `language`

    const out = await groqFetch("/audio/transcriptions", { body: form });

    const detected = (out.language || "").toLowerCase();
    const language_code = WHISPER_LANG_TO_CODE[detected] || fallbackLang.code;

    res.json({ transcript: out.text || "", language_code });
  } catch (err) {
    console.error("STT error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

const { Router } = require("express");
const { getLang, CHAT_MODEL } = require("../config");
const { sarvaFetch } = require("../sarvam");
const { rateLimit } = require("../rate-limit");

const router = Router();

// POST /api/chat : the assistant's "brain".
// Understands the user's message and returns a reply in the user's language.
// body: { message: string, lang?: 'hi'|'ta'|..., history?: [{role, content}] }
router.post("/", rateLimit, async (req, res) => {
  try {
    const { message, lang: langCode, history } = req.body || {};
    if (!message) return res.status(400).json({ error: "message is required" });

    const lang = getLang(langCode);
    const system = `You are a friendly multilingual voice assistant speaking to someone out loud. Always answer in ${lang.name} (ISO ${lang.code}). Keep the ENTIRE reply under 400 characters — 2-3 short spoken sentences, no bullet points or headings. If the question has multiple parts, give the single most important point for each part in one line, then ask if they want more detail on any one part.`;

    const messages = [
      { role: "system", content: system },
      ...(history || []).slice(-8),
      { role: "user", content: message },
    ];

    // POST /v1/chat/completions (OpenAI-compatible shape); model is required.
    // reasoning_effort disabled: sarvam-105b is a reasoning model that
    // otherwise burns max_tokens on internal thinking before writing the
    // actual reply, sometimes leaving 0 tokens for the answer itself
    // (empty "content" → the tts route then rejects the blank text).
    const out = await sarvaFetch("/v1/chat/completions", {
      method: "POST",
      body: {
        model: CHAT_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 400,
        reasoning_effort: null,
      },
    });

    const reply =
      out.choices?.[0]?.message?.content?.trim() ||
      `Sorry, I couldn't come up with a reply just now. Please try asking again.`;
    res.json({ reply, lang: lang.code });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
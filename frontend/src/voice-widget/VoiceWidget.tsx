import React, { useEffect, useRef, useState } from "react";
import { X, Send, Mic, Square, Sparkles, Globe2, ChevronDown, Wand2 } from "lucide-react";
import { useVoiceAssistant } from "./useVoiceAssistant";
import { GhostMascot } from "./GhostMascot";

export interface VoiceWidgetProps {
  /** Optional backend for real STT/TTS/chat (Sarvam-powered). Omit for the free, offline-friendly browser fallback. */
  backendUrl?: string;
  defaultLang?: string;
}

const STATUS_COPY: Record<string, string> = {
  idle: "Tap the mic or type a question below.",
  listening: "Listening — go ahead.",
  thinking: "Looking into that for you...",
  speaking: "Here's what I found.",
  error: "That didn't go through — try again.",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  idle: "vw-dot-idle",
  listening: "vw-dot-listening",
  thinking: "vw-dot-thinking",
  speaking: "vw-dot-speaking",
  error: "vw-dot-error",
};

// Floating overlay that drops the voice assistant on top of any page — a
// standalone mascot (no button chrome/circle around it) that expands into a
// structured panel. Self-contained (own copy of the hook + language list) so
// it can sit inside LoginPages without touching the VoiceAsst package.
export function VoiceWidget({ backendUrl, defaultLang }: VoiceWidgetProps) {
  const [open, setOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const asst = useVoiceAssistant({ backendUrl, defaultLang });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [asst.transcript, asst.reply, asst.error, open]);

  const handleSend = () => {
    if (!textInput.trim()) return;
    asst.sendText(textInput);
    setTextInput("");
  };

  const activeLang = asst.languages.find((l) => l.code === asst.lang) ?? asst.languages[0];

  return (
    <div className="vw-root">
      <style>{VOICE_WIDGET_CSS}</style>

      {open && (
        <div className="vw-panel" role="dialog" aria-label="Voice assistant">
          <div className="vw-panel-accent" />

          <div className="vw-panel-header">
            <div className="vw-header-left">
              <GhostMascot size={40} status={asst.status} listening={asst.listening} />
              <div>
                <div className="vw-title">MyHospital Care Assistant</div>
                <div className="vw-status-row">
                  <span className={`vw-dot ${STATUS_DOT_CLASS[asst.status] ?? "vw-dot-idle"}`} />
                  <span className="vw-status-text">{STATUS_COPY[asst.status] ?? STATUS_COPY.idle}</span>
                </div>
              </div>
            </div>
            <button className="vw-close" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={16} />
            </button>
          </div>

          <button className="vw-lang-summary" onClick={() => setLangMenuOpen((v) => !v)} aria-expanded={langMenuOpen}>
            {asst.autoLang ? <Wand2 size={12} /> : <Globe2 size={12} />}
            <span>
              {asst.autoLang ? "Auto-detecting" : "Language"} · <b>{activeLang.label}</b>
            </span>
            <ChevronDown size={13} className={langMenuOpen ? "vw-chevron-open" : ""} />
          </button>

          {langMenuOpen && (
            <div className="vw-langs">
              {asst.languages.map((l) => (
                <button
                  key={l.code}
                  className={`vw-lang-chip ${asst.lang === l.code ? "vw-lang-active" : ""}`}
                  onClick={() => {
                    asst.changeLanguage(l.code);
                    setLangMenuOpen(false);
                  }}
                >
                  {l.label}
                </button>
              ))}
              {!asst.autoLang && (
                <button className="vw-lang-chip vw-lang-auto" onClick={() => asst.resetToAutoLanguage()}>
                  <Wand2 size={11} /> Auto
                </button>
              )}
            </div>
          )}

          <div className="vw-divider" />

          <div className="vw-body" ref={scrollRef}>
            {!asst.transcript && !asst.reply && !asst.error && (
              <div className="vw-empty">
                <Sparkles size={14} />
                Ask as a patient or doctor — signing in, resetting a password, or anything else — in {activeLang.label.replace(/^\S+\s/, "")}.
              </div>
            )}

            {asst.transcript && (
              <div className="vw-bubble vw-bubble-user">
                <span className="vw-bubble-label">You</span>
                {asst.transcript}
              </div>
            )}
            {asst.reply && (
              <div className="vw-bubble vw-bubble-bot">
                <span className="vw-bubble-label">Care Assistant</span>
                {asst.reply}
              </div>
            )}
            {asst.error && <div className="vw-error">{asst.error}</div>}
          </div>

          <div className="vw-controls">
            <div className="vw-input-row">
              <input
                className="vw-input"
                placeholder="Type a question..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button className="vw-send" onClick={handleSend} aria-label="Send message">
                <Send size={15} />
              </button>
              <button
                className={`vw-mic-btn ${asst.listening ? "vw-mic-listening" : ""}`}
                onClick={() => (asst.listening ? asst.stopListening() : asst.startListening())}
                aria-pressed={asst.listening}
                aria-label={asst.listening ? "Stop listening" : "Start listening"}
              >
                {asst.listening ? <Square size={15} /> : <Mic size={15} />}
              </button>
            </div>
          </div>

          <div className="vw-footer">HealthForGood · voice + text · 9 languages</div>
        </div>
      )}

      <button
        className="vw-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        <GhostMascot size={67} status={asst.status} listening={asst.listening} />
      </button>
    </div>
  );
}

const VOICE_WIDGET_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');

@keyframes vw-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes vw-blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.12); } }
@keyframes vw-look { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
@keyframes vw-talk { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.45); } }
@keyframes vw-pop-in { 0% { opacity: 0; transform: translateY(14px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes vw-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

.vw-root {
  --vw-teal: #0E9C8F;
  --vw-teal-deep: #0B7A70;
  --vw-navy: #0B2B3C;
  --vw-navy-soft: #4C6B78;
  --vw-ink: #10262E;
  --vw-ink-soft: #5C7680;
  --vw-field-bg: #F2F8F7;
  --vw-line: #DCEBE8;
  --vw-accent: #2C7FF2;
  --vw-danger: #E5544A;
  font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
}
.vw-root *, .vw-root *::before, .vw-root *::after { box-sizing: border-box; }

/* ---------- Mascot ---------- */
.ghost-mascot { position: relative; display: grid; place-items: center; animation: vw-bob 4.5s ease-in-out infinite; filter: drop-shadow(0 8px 14px rgba(11, 43, 60, 0.22)); }
.ghost-svg { position: relative; z-index: 1; }
.ghost-eye { animation: vw-blink 4.2s ease-in-out infinite; }
.ghost-mood-thinking .ghost-eye { animation: vw-look 1.1s ease-in-out infinite; }
.ghost-mood-listening .ghost-eye-left, .ghost-mood-listening .ghost-eye-right { transform: scale(1.12); }
.ghost-mouth { transform-origin: 100px 124px; }
.ghost-mood-speaking .ghost-mouth { animation: vw-talk 0.32s ease-in-out infinite; }

/* ---------- Layout ---------- */
.vw-root { position: fixed; right: 22px; bottom: 22px; z-index: 2147483000; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }

.vw-launcher { position: relative; border: none; background: transparent; padding: 4px; cursor: pointer; display: grid; place-items: center; transition: transform 0.2s ease; line-height: 0; }
.vw-launcher:hover { transform: scale(1.05); }
.vw-launcher:active { transform: scale(0.96); }

.vw-panel { width: min(320px, calc(100vw - 40px)); max-height: min(520px, calc(100vh - 130px)); display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.97); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 18px; box-shadow: 0 22px 50px rgba(6, 34, 32, 0.22), 0 2px 8px rgba(6, 34, 32, 0.12); overflow: hidden; animation: vw-pop-in 0.24s cubic-bezier(.22,.9,.4,1) both; position: relative; }
.vw-panel-accent { height: 3px; background: linear-gradient(90deg, var(--vw-teal), var(--vw-accent) 60%, var(--vw-teal-deep)); }

.vw-panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 14px 14px 12px; border-bottom: 1px solid var(--vw-line); }
.vw-header-left { display: flex; align-items: center; gap: 10px; }
.vw-title { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 13.5px; color: var(--vw-navy); letter-spacing: 0.1px; }
.vw-status-row { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.vw-status-text { font-size: 11px; font-weight: 600; color: var(--vw-ink-soft); }
.vw-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.vw-dot-idle { background: #9BB0AE; }
.vw-dot-listening { background: var(--vw-accent); animation: vw-pulse-dot 1.1s ease-in-out infinite; }
.vw-dot-thinking { background: #e0a53c; animation: vw-pulse-dot 0.9s ease-in-out infinite; }
.vw-dot-speaking { background: var(--vw-teal); animation: vw-pulse-dot 0.7s ease-in-out infinite; }
.vw-dot-error { background: var(--vw-danger); }
.vw-close { border: none; background: var(--vw-field-bg); color: var(--vw-ink-soft); width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; cursor: pointer; flex-shrink: 0; transition: background 0.2s ease, color 0.2s ease; }
.vw-close:hover { background: var(--vw-line); color: var(--vw-navy); }

.vw-lang-summary { width: 100%; display: flex; align-items: center; gap: 6px; padding: 10px 14px; border: none; background: transparent; color: var(--vw-ink-soft); font-size: 11.5px; font-weight: 700; cursor: pointer; text-align: left; }
.vw-lang-summary:hover { color: var(--vw-navy); }
.vw-lang-summary b { color: var(--vw-navy); font-weight: 800; }
.vw-lang-summary svg:first-child { flex-shrink: 0; color: var(--vw-teal-deep); }
.vw-lang-summary span { flex: 1; }
.vw-chevron-open { transform: rotate(180deg); }
.vw-lang-summary svg.vw-chevron-open, .vw-lang-summary svg:last-child { transition: transform 0.18s ease; flex-shrink: 0; }

.vw-langs { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 10px; }
.vw-lang-chip { flex-shrink: 0; border: 1.5px solid var(--vw-line); background: var(--vw-field-bg); color: var(--vw-ink-soft); font-weight: 700; font-size: 11px; padding: 5px 10px; border-radius: 7px; cursor: pointer; transition: all 0.16s ease; display: inline-flex; align-items: center; gap: 4px; }
.vw-lang-chip:hover { border-color: var(--vw-teal); }
.vw-lang-active { background: var(--vw-teal); border-color: var(--vw-teal); color: #fff; }
.vw-lang-auto { border-style: dashed; color: var(--vw-ink-soft); }

.vw-divider { height: 1px; background: var(--vw-line); margin: 0 14px; }

.vw-body { flex: 1; min-height: 80px; max-height: 210px; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
.vw-empty { display: flex; align-items: flex-start; gap: 7px; color: var(--vw-ink-soft); font-size: 12px; font-weight: 600; line-height: 1.5; background: var(--vw-field-bg); border: 1px dashed var(--vw-line); border-radius: 10px; padding: 9px 11px; }
.vw-bubble { max-width: 90%; padding: 8px 11px; border-radius: 10px; font-size: 12.5px; font-weight: 600; line-height: 1.5; }
.vw-bubble-label { display: block; font-size: 9px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; opacity: 0.7; margin-bottom: 2px; }
.vw-bubble-user { align-self: flex-end; background: linear-gradient(135deg, var(--vw-teal) 0%, var(--vw-teal-deep) 100%); color: #fff; border-bottom-right-radius: 3px; }
.vw-bubble-bot { align-self: flex-start; background: var(--vw-field-bg); color: var(--vw-ink); border: 1px solid var(--vw-line); border-bottom-left-radius: 3px; }
.vw-error { align-self: stretch; background: rgba(229, 84, 74, 0.1); color: var(--vw-danger); border: 1px solid rgba(229, 84, 74, 0.25); border-radius: 10px; padding: 8px 11px; font-size: 11.5px; font-weight: 700; }

.vw-controls { padding: 0 14px 12px; }
.vw-input-row { display: flex; gap: 6px; }
.vw-input { flex: 1; min-width: 0; border: 1.5px solid var(--vw-line); border-radius: 9px; padding: 9px 11px; font-size: 12.5px; font-weight: 600; color: var(--vw-ink); background: var(--vw-field-bg); outline: none; transition: border-color 0.2s ease, background 0.2s ease; }
.vw-input:focus { border-color: var(--vw-teal); background: #fff; }
.vw-input::placeholder { color: #9BB0AE; font-weight: 600; }
.vw-send, .vw-mic-btn { flex-shrink: 0; width: 34px; border: none; border-radius: 9px; background: var(--vw-field-bg); color: var(--vw-teal-deep); display: grid; place-items: center; cursor: pointer; transition: background 0.2s ease, color 0.2s ease; }
.vw-send:hover { background: var(--vw-line); color: var(--vw-navy); }
.vw-mic-btn:hover { background: var(--vw-teal); color: #fff; }
.vw-mic-listening { background: var(--vw-danger); color: #fff; animation: vw-pulse-dot 0.9s ease-in-out infinite; }

.vw-footer { padding: 9px 14px; font-size: 9.5px; font-weight: 700; color: var(--vw-ink-soft); text-align: center; border-top: 1px solid var(--vw-line); letter-spacing: 0.2px; }

@media (max-width: 480px) {
  .vw-root { right: 14px; bottom: 14px; }
  .vw-panel { width: calc(100vw - 28px); }
}
`;

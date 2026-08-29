import React, { useEffect, useRef, useState } from "react";
import { X, Mic, Square, RotateCcw, Check, BarChart3 } from "lucide-react";
import { GhostMascot } from "../GhostMascot";
import { useVitalsCheckIn } from "./useVitalsCheckIn";
import { VITAL_QUESTIONS } from "./vitalsQuestions";
import type { AssistantStatus } from "../useVoiceAssistant";

export interface VitalsCheckInProps {
  backendUrl: string;
  patientId: string;
  lang: string;
  onClose: () => void;
  onViewHistory: () => void;
}

// Phase -> the same status vocabulary GhostMascot already animates against
// (mouth moves while "speaking", eyes track while "thinking", etc).
const PHASE_TO_STATUS: Record<string, AssistantStatus> = {
  idle: "idle",
  asking: "speaking",
  listening: "listening",
  processing: "thinking",
  retry: "error",
  error: "error",
  done: "idle",
};

export function VitalsCheckIn({ backendUrl, patientId, lang, onClose, onViewHistory }: VitalsCheckInProps) {
  const v = useVitalsCheckIn(backendUrl, patientId);
  const [typedAnswer, setTypedAnswer] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    v.start(lang);
    startedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drives the question sequence: once idle (fresh start, or just advanced
  // to the next step), speak + listen for the current question.
  useEffect(() => {
    if (v.phase === "idle") {
      startedRef.current = true;
      v.askCurrentQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.phase, v.stepIndex]);

  const handleTypedSubmit = () => {
    if (!typedAnswer.trim()) return;
    v.submitTypedAnswer(typedAnswer.trim());
    setTypedAnswer("");
  };

  return (
    <div className="vc-overlay" role="dialog" aria-modal="true" aria-label="Vitals check-in">
      <style>{VITALS_CHECKIN_CSS}</style>
      <div className="vc-scrim" onClick={v.phase === "done" || v.phase === "error" ? onClose : undefined} />

      <button className="vc-close" onClick={onClose} aria-label="Cancel check-in">
        <X size={18} />
      </button>

      <div className="vc-stage">
        <div className="vc-mascot">
          <GhostMascot size={140} status={PHASE_TO_STATUS[v.phase] ?? "idle"} listening={v.phase === "listening"} />
        </div>

        {v.phase !== "done" && (
          <>
            <div className="vc-progress">
              {VITAL_QUESTIONS.map((q, i) => (
                <span key={q.key} className={`vc-dot ${i < v.stepIndex ? "vc-dot-done" : i === v.stepIndex ? "vc-dot-active" : ""}`} />
              ))}
            </div>

            <div className="vc-question">
              <span className="vc-question-icon">{v.question.icon}</span>
              {v.question.promptEn}
            </div>
            <div className="vc-hint">{v.question.exampleHint}</div>

            {v.liveTranscript && <div className="vc-heard">"{v.liveTranscript}"</div>}
            {(v.phase === "retry" || v.phase === "error") && v.errorMsg && <div className="vc-error">{v.errorMsg}</div>}

            <div className="vc-controls">
              {v.phase === "listening" ? (
                <button className="vc-mic-btn vc-mic-active" onClick={v.stopRecording}>
                  <Square size={16} /> Stop
                </button>
              ) : v.phase === "processing" ? (
                <button className="vc-mic-btn" disabled>
                  Working on it...
                </button>
              ) : (
                <button className="vc-mic-btn" onClick={v.listen}>
                  <Mic size={16} /> {v.phase === "retry" ? "Try again" : "Answer"}
                </button>
              )}
              {v.phase === "asking" && (
                <button className="vc-repeat" onClick={v.askCurrentQuestion} aria-label="Repeat question">
                  <RotateCcw size={14} />
                </button>
              )}
            </div>

            <div className="vc-type-row">
              <input
                className="vc-type-input"
                placeholder="...or type your answer"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTypedSubmit()}
              />
              <button className="vc-type-send" onClick={handleTypedSubmit}>
                <Check size={15} />
              </button>
            </div>
          </>
        )}

        {v.phase === "done" && (
          <div className="vc-summary">
            <div className="vc-summary-title">All set — here's what I logged</div>
            <div className="vc-summary-grid">
              {v.captured.map((c) => {
                const q = VITAL_QUESTIONS.find((q) => q.key === c.key)!;
                const display =
                  typeof c.value === "object" ? `${c.value.systolic}/${c.value.diastolic}` : String(c.value);
                return (
                  <div className="vc-tile" key={c.key}>
                    <div className="vc-tile-icon">{q.icon}</div>
                    <div className="vc-tile-value">
                      {display} <span>{q.unit}</span>
                    </div>
                    <div className="vc-tile-label">{q.label}</div>
                  </div>
                );
              })}
            </div>
            <div className="vc-summary-actions">
              <button className="vc-history-btn" onClick={onViewHistory}>
                <BarChart3 size={15} /> View my vitals history
              </button>
              <button className="vc-done-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}

        {v.phase === "error" && (
          <button className="vc-done-btn" onClick={onClose} style={{ marginTop: 14 }}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}

const VITALS_CHECKIN_CSS = `
@keyframes vc-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes vc-stage-in { from { opacity: 0; transform: scale(0.94) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.vc-overlay { position: fixed; inset: 0; z-index: 2147483600; display: grid; place-items: center; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif; }
.vc-overlay *, .vc-overlay *::before, .vc-overlay *::after { box-sizing: border-box; }
.vc-scrim { position: absolute; inset: 0; background: rgba(6, 34, 32, 0.72); backdrop-filter: blur(10px) saturate(0.8); -webkit-backdrop-filter: blur(10px) saturate(0.8); animation: vc-fade-in 0.25s ease both; }
.vc-close { position: absolute; top: 22px; right: 22px; z-index: 2; border: none; background: rgba(255, 255, 255, 0.1); color: #EAF7F4; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; cursor: pointer; transition: background 0.2s ease; }
.vc-close:hover { background: rgba(255, 255, 255, 0.18); }

.vc-stage { position: relative; z-index: 1; width: min(420px, calc(100vw - 40px)); max-height: calc(100vh - 60px); overflow-y: auto; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 12px; animation: vc-stage-in 0.32s cubic-bezier(.22,.9,.4,1) both; }
.vc-mascot { margin-bottom: 6px; }

.vc-progress { display: flex; gap: 7px; margin-bottom: 18px; }
.vc-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); transition: background 0.2s ease, transform 0.2s ease; }
.vc-dot-active { background: #0E9C8F; transform: scale(1.3); }
.vc-dot-done { background: #6EF0C8; }

.vc-question { color: #fff; font-size: 18px; font-weight: 800; line-height: 1.4; display: flex; align-items: center; gap: 8px; justify-content: center; }
.vc-question-icon { font-size: 22px; }
.vc-hint { color: #B7DAD5; font-size: 12.5px; font-weight: 600; margin-top: 6px; }
.vc-heard { margin-top: 16px; color: #EAF7F4; font-size: 13.5px; font-weight: 600; font-style: italic; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 8px 14px; max-width: 100%; }
.vc-error { margin-top: 14px; color: #ffb4af; background: rgba(229, 84, 74, 0.16); border: 1px solid rgba(229, 84, 74, 0.3); border-radius: 12px; padding: 9px 14px; font-size: 12.5px; font-weight: 700; }

.vc-controls { display: flex; align-items: center; gap: 10px; margin-top: 22px; }
.vc-mic-btn { display: flex; align-items: center; gap: 8px; border: none; border-radius: 14px; padding: 12px 22px; font-weight: 800; font-size: 14.5px; color: #fff; background: linear-gradient(135deg, #0E9C8F, #0B7A70); cursor: pointer; box-shadow: 0 12px 26px rgba(14, 156, 143, 0.4); transition: transform 0.15s ease; }
.vc-mic-btn:hover { transform: translateY(-1px); }
.vc-mic-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
.vc-mic-active { background: #E5544A; box-shadow: 0 12px 26px rgba(229, 84, 74, 0.4); }
.vc-repeat { border: none; background: rgba(255, 255, 255, 0.1); color: #EAF7F4; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; cursor: pointer; }
.vc-repeat:hover { background: rgba(255, 255, 255, 0.18); }

.vc-type-row { display: flex; gap: 8px; margin-top: 20px; width: 100%; max-width: 320px; }
.vc-type-input { flex: 1; min-width: 0; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 10px; padding: 9px 12px; font-size: 13px; font-weight: 600; color: #fff; background: rgba(255, 255, 255, 0.07); outline: none; }
.vc-type-input:focus { border-color: #0E9C8F; }
.vc-type-input::placeholder { color: #8FBDB6; }
.vc-type-send { flex-shrink: 0; width: 36px; border: none; border-radius: 10px; background: rgba(255, 255, 255, 0.1); color: #EAF7F4; display: grid; place-items: center; cursor: pointer; }
.vc-type-send:hover { background: rgba(255, 255, 255, 0.18); }

.vc-summary { width: 100%; }
.vc-summary-title { color: #fff; font-size: 17px; font-weight: 800; margin-bottom: 16px; }
.vc-summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.vc-tile { background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 14px 10px; }
.vc-tile-icon { font-size: 20px; margin-bottom: 6px; }
.vc-tile-value { color: #fff; font-size: 18px; font-weight: 800; }
.vc-tile-value span { font-size: 11px; font-weight: 700; color: #B7DAD5; margin-left: 2px; }
.vc-tile-label { color: #B7DAD5; font-size: 11px; font-weight: 700; margin-top: 3px; }

.vc-summary-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
.vc-history-btn { display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 14px; padding: 12px; font-weight: 800; font-size: 13.5px; color: #fff; background: linear-gradient(135deg, #0E9C8F, #0B7A70); cursor: pointer; }
.vc-done-btn { border: 1px solid rgba(255, 255, 255, 0.18); background: transparent; color: #EAF7F4; border-radius: 14px; padding: 11px; font-weight: 700; font-size: 13.5px; cursor: pointer; }
.vc-done-btn:hover { background: rgba(255, 255, 255, 0.08); }

@media (max-width: 480px) {
  .vc-summary-grid { grid-template-columns: 1fr 1fr; }
}
`;

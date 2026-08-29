import React, { useId } from "react";
import type { AssistantStatus } from "./useVoiceAssistant";

export interface GhostMascotProps {
  size?: number;
  status: AssistantStatus;
  listening: boolean;
  className?: string;
}

// A friendly floating mascot — the "face" of the assistant. Pure SVG + CSS,
// no 3D model, so it never has a loading/failure state and always looks
// intentional. No background disc/halo — it's rendered as a standalone
// silhouette so it reads as an overlay, not a chat-widget button. Eyes/mouth
// react to the assistant's live status.
export function GhostMascot({ size = 120, status, listening, className = "" }: GhostMascotProps) {
  const uid = useId().replace(/[:]/g, "");
  const bodyGrad = `ghost-body-${uid}`;
  const shadeGrad = `ghost-shade-${uid}`;

  const active = listening || status === "speaking" || status === "thinking";
  const mood =
    status === "error" ? "error" : listening ? "listening" : status === "thinking" ? "thinking" : status === "speaking" ? "speaking" : "idle";

  return (
    <div className={`ghost-mascot ghost-mood-${mood} ${active ? "ghost-active" : ""} ${className}`} style={{ width: size, height: size * 1.05 }}>
      <svg viewBox="0 0 200 208" width="100%" height="100%" className="ghost-svg">
        <defs>
          <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#EAF7F4" />
            <stop offset="100%" stopColor="#9FE0D3" />
          </linearGradient>
          <linearGradient id={shadeGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0B2B3C" stopOpacity="0" />
            <stop offset="100%" stopColor="#0B2B3C" stopOpacity="0.14" />
          </linearGradient>
        </defs>

        <path
          className="ghost-body"
          d="M100,10 C55,10 24,42 24,88 L24,168 C36,156 44,180 60,168 C74,158 84,182 100,168 C116,182 126,158 140,168 C156,180 164,156 176,168 L176,88 C176,42 145,10 100,10 Z"
          fill={`url(#${bodyGrad})`}
          stroke="rgba(11, 43, 60, 0.22)"
          strokeWidth="1.5"
        />
        <path
          d="M100,10 C55,10 24,42 24,88 L24,168 C36,156 44,180 60,168 C74,158 84,182 100,168 C116,182 126,158 140,168 C156,180 164,156 176,168 L176,88 C176,42 145,10 100,10 Z"
          fill={`url(#${shadeGrad})`}
        />

        {/* glossy highlight */}
        <ellipse cx="70" cy="56" rx="24" ry="14" fill="#ffffff" opacity="0.5" />

        {/* eyes */}
        <g className="ghost-eye ghost-eye-left" style={{ transformOrigin: "72px 92px" }}>
          {mood === "error" ? (
            <g stroke="#0B2B3C" strokeWidth="6" strokeLinecap="round">
              <line x1="62" y1="82" x2="82" y2="102" />
              <line x1="82" y1="82" x2="62" y2="102" />
            </g>
          ) : (
            <ellipse cx="72" cy="92" rx="10" ry="14" fill="#0B2B3C" />
          )}
        </g>
        <g className="ghost-eye ghost-eye-right" style={{ transformOrigin: "128px 92px" }}>
          {mood === "error" ? (
            <g stroke="#0B2B3C" strokeWidth="6" strokeLinecap="round">
              <line x1="118" y1="82" x2="138" y2="102" />
              <line x1="138" y1="82" x2="118" y2="102" />
            </g>
          ) : (
            <ellipse cx="128" cy="92" rx="10" ry="14" fill="#0B2B3C" />
          )}
        </g>
        {mood !== "error" && (
          <>
            <circle cx="75.5" cy="87" r="3" fill="#fff" opacity="0.9" />
            <circle cx="131.5" cy="87" r="3" fill="#fff" opacity="0.9" />
          </>
        )}

        {/* mouth */}
        <ellipse className="ghost-mouth" cx="100" cy="124" rx="13" ry="16" fill="#0B2B3C" />
      </svg>
    </div>
  );
}

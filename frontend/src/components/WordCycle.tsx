import { useEffect, useRef, useState } from 'react';

/**
 * Standalone looping typewriter: types words[0], holds, erases, types words[1],
 * … and repeats forever. One self-rescheduling timer, cleaned up on unmount.
 * `prefers-reduced-motion` → first word, static, no caret.
 */

let styleInjected = false;
function ensureStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  styleInjected = true;
  const el = document.createElement('style');
  el.textContent = `
    .wc { display: inline-block; white-space: nowrap; }
    .wc-caret {
      display: inline-block; width: 2px; height: .95em; margin-left: 3px;
      vertical-align: -0.12em; background: currentColor;
      animation: wc-blink 1s steps(1, end) infinite;
    }
    @keyframes wc-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
  `;
  document.head.appendChild(el);
}

export function WordCycle({
  words,
  className = '',
}: {
  words: string[];
  className?: string;
}) {
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current;
  const [text, setText] = useState(reduced ? (words[0] ?? '') : '');
  const key = words.join('|');

  useEffect(() => {
    ensureStyle();
    if (reduced) {
      setText(words[0] ?? '');
      return;
    }

    const TYPE = 62;
    const ERASE = 34;
    const HOLD = 1600;
    const GAP = 420;
    let wi = 0;
    let ci = 0;
    let phase: 'type' | 'hold' | 'erase' | 'gap' = 'type';
    let timer = 0;

    const step = () => {
      const w = words[wi % words.length];
      if (phase === 'type') {
        ci += 1;
        setText(w.slice(0, ci));
        if (ci >= w.length) {
          phase = 'hold';
          timer = window.setTimeout(step, HOLD);
        } else timer = window.setTimeout(step, TYPE);
      } else if (phase === 'hold') {
        phase = 'erase';
        timer = window.setTimeout(step, ERASE);
      } else if (phase === 'erase') {
        ci -= 1;
        setText(w.slice(0, Math.max(0, ci)));
        if (ci <= 0) {
          phase = 'gap';
          timer = window.setTimeout(step, GAP);
        } else timer = window.setTimeout(step, ERASE);
      } else {
        wi += 1;
        ci = 0;
        phase = 'type';
        timer = window.setTimeout(step, TYPE);
      }
    };

    setText('');
    timer = window.setTimeout(step, 400);
    return () => clearTimeout(timer);
  }, [reduced, key]);

  return (
    <span className={`wc ${className}`.trim()}>
      {text}
      {!reduced && <i className="wc-caret" />}
    </span>
  );
}

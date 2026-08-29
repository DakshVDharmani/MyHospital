import { useEffect, useRef, useState } from 'react';
import { ArrowRight, HeartPulse } from 'lucide-react';
import { SECTIONS } from './scenes';

/* ---------------- Loading state ---------------- */

export function Loader({ progress, done }: { progress: number; done: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return (
    <div className={`lp-loader ${done ? 'is-done' : ''}`} role="status" aria-live="polite">
      <div className="lp-loader-mark">
        <HeartPulse size={16} strokeWidth={2.4} />
      </div>
      <div className="lp-loader-word">MyHospital</div>
      <div className="lp-loader-sub">Preparing the experience</div>
      <div className="lp-loader-bar">
        <span style={{ transform: `scaleX(${Math.max(0.04, Math.min(1, progress))})` }} />
      </div>
    </div>
  );
}

/* ---------------- Minimal navigation ---------------- */

export function NavBar({
  dim,
  onLogin,
  onSignup,
}: {
  dim: boolean;
  onLogin: () => void;
  onSignup: () => void;
}) {
  return (
    <nav className={`lp-nav ${dim ? 'is-dim' : ''}`}>
      <div className="lp-brand">
        <span className="lp-brand-mark">
          <HeartPulse size={15} strokeWidth={2.5} />
        </span>
        MyHospital
      </div>
      <div className="lp-nav-links">
        <a href="#product">Product</a>
        <a href="#impact">Impact</a>
        <button className="lp-nav-ghost" onClick={onLogin}>
          Log in
        </button>
        <button className="lp-nav-cta" onClick={onSignup}>
          Sign up <ArrowRight size={13} />
        </button>
      </div>
    </nav>
  );
}

/* ---------------- Editorial caption per beat ---------------- */

const BRAND_WORD = 'HealthForGood';

/**
 * The "01 — …" tag. On every section change it types the section name
 * (PRESENCE, LISTEN, …), holds, erases it, then retypes "HealthForGood".
 * Reduced motion → static brand word, no caret.
 */
function useTypeCycle(section: number, reduced: boolean) {
  const name = SECTIONS[section].name.toUpperCase();
  const [text, setText] = useState(reduced ? BRAND_WORD : '');

  useEffect(() => {
    if (reduced) {
      setText(BRAND_WORD);
      return;
    }
    const timers: number[] = [];
    let t = 0;
    const TYPE = 52;
    const ERASE = 30;
    const HOLD = 950;
    const at = (s: string, d: number) => {
      t += d;
      timers.push(window.setTimeout(() => setText(s), t));
    };

    setText('');
    for (let i = 1; i <= name.length; i++) at(name.slice(0, i), TYPE);
    t += HOLD;
    for (let i = name.length - 1; i >= 0; i--) at(name.slice(0, i), ERASE);
    t += 140;
    for (let i = 1; i <= BRAND_WORD.length; i++) at(BRAND_WORD.slice(0, i), TYPE);

    return () => timers.forEach(clearTimeout);
  }, [section, reduced, name]);

  return text;
}

export function SceneCaption({ section, reduced }: { section: number; reduced: boolean }) {
  const s = SECTIONS[section];
  const typed = useTypeCycle(section, reduced);
  return (
    <div className="lp-caption">
      <span className="lp-caption-tag">
        {String(section + 1).padStart(2, '0')} —{' '}
        <span className="lp-caption-type">
          {typed}
          {!reduced && <i className="lp-type-caret" />}
        </span>
      </span>
      <h2 className="lp-caption-lines" key={section}>
        {s.copy.map((line, i) => (
          <span key={i} style={{ animationDelay: `${0.08 + i * 0.07}s` }}>
            {line}
          </span>
        ))}
      </h2>
    </div>
  );
}

/* ---------------- Story progress indicator ---------------- */

export function ScrollProgress({
  section,
  progressRef,
}: {
  section: number;
  progressRef: React.RefObject<number>;
}) {
  const fillRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (fillRef.current)
        fillRef.current.style.transform = `scaleY(${Math.max(0, Math.min(1, progressRef.current ?? 0))})`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <div className="lp-progress">
      <div className="lp-progress-count" key={section}>
        <span className="lp-progress-num">{String(section + 1).padStart(2, '0')}</span>
        <span className="lp-progress-total">/ 05</span>
      </div>
      <div className="lp-progress-rail">
        <span ref={fillRef} className="lp-progress-fill" />
        {SECTIONS.map((s, i) => (
          <span key={s.name} className={`lp-progress-tick ${i <= section ? 'is-on' : ''}`}>
            <i />
            <em>{s.name}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Scroll hint (fades after first scroll) ---------------- */

export function ScrollHint({ hidden }: { hidden: boolean }) {
  return (
    <div className={`lp-hint ${hidden ? 'is-hidden' : ''}`} aria-hidden="true">
      <span>Scroll</span>
      <i />
    </div>
  );
}

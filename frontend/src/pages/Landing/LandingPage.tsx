import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useRouteTransition } from '../../components/RouteTransition';
import {
  Activity,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';

// The WebGL layer (three + GLTFLoader + PMREM) loads after the HTML/UI paints.
const StethoscopeExperience = lazy(() =>
  import('./StethoscopeExperience').then((m) => ({ default: m.StethoscopeExperience })),
);
import { Loader, NavBar, SceneCaption, ScrollHint, ScrollProgress } from './Overlay';
import {
  useIsLowPower,
  usePointerParallax,
  useReducedMotion,
  useScrollProgress,
} from './hooks';

const FEATURES = [
  {
    icon: <MessageSquare size={18} />,
    title: 'Secure messaging',
    body: 'Patients and doctors talk directly — no clinic visit required for a quick question or a follow-up.',
  },
  {
    icon: <Activity size={18} />,
    title: 'Care that prioritizes itself',
    body: 'Doctors see who needs them first, automatically — critical cases never wait behind routine ones.',
  },
  {
    icon: <ShieldCheck size={18} />,
    title: 'Built for trust',
    body: 'HIPAA-aware by design, with every record and message kept private between patient and care team.',
  },
];

export default function LandingPage() {
  const { go } = useRouteTransition();
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);

  const { smoothRef, velocityRef, section } = useScrollProgress(scrollRef);
  const pointerRef = usePointerParallax();
  const reducedMotion = useReducedMotion();
  const lowPower = useIsLowPower();

  const [loadProgress, setLoadProgress] = useState(0.08);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The page background + vignette follow the timeline. Written straight to the
  // DOM node (never React state) so scrolling triggers zero re-renders.
  const handleBackground = useCallback((top: string, bottom: string, vig: number) => {
    const el = pageRef.current;
    if (!el) return;
    el.style.background = `radial-gradient(125% 90% at 50% 12%, ${top} 0%, ${bottom} 68%)`;
    el.style.setProperty('--vig', vig.toFixed(3));
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 40) setScrolled(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Never let the loader trap the page if the 3D layer stalls or fails.
    const failSafe = setTimeout(() => setReady(true), 9000);
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(failSafe);
    };
  }, []);

  const goSignup = () => go('/signup');
  const goLogin = () => go('/login');

  return (
    <div className="lp-page" ref={pageRef}>
      <style>{CSS}</style>

      <Loader progress={loadProgress} done={ready} />
      <NavBar dim={section === 1 || section === 2} onLogin={goLogin} onSignup={goSignup} />

      <h1 className="lp-sr-only">
        MyHospital — care that shows up on time, wherever you are. A HealthForGood initiative
        connecting patients in underserved communities with licensed doctors and nurses.
      </h1>

      {/* ---------- The cinematic, scroll-driven act ---------- */}
      <section className="lp-scroll" ref={scrollRef} aria-label="Introduction">
        <div className="lp-sticky">
          <Suspense fallback={null}>
            <StethoscopeExperience
              progressRef={smoothRef}
              velocityRef={velocityRef}
              pointerRef={pointerRef}
              reducedMotion={reducedMotion}
              lowPower={lowPower}
              onBackground={handleBackground}
              onLoadProgress={setLoadProgress}
              onReady={() => {
                setLoadProgress(1);
                setReady(true);
              }}
            />
          </Suspense>
          <div className="lp-overlay">
            <SceneCaption section={section} reduced={reducedMotion} />
            <ScrollProgress section={section} progressRef={smoothRef} />
            <ScrollHint hidden={scrolled} />
          </div>
          <div className="lp-vignette" aria-hidden="true" />
        </div>
      </section>

      {/* ---------- Grounded content ---------- */}
      <main className="lp-grounded">
        <section className="lp-block" id="product">
          <p className="lp-eyebrow">The platform</p>
          <h2 className="lp-h2">One place for patients and doctors to actually connect.</h2>
          <p className="lp-lead">
            Built with HealthForGood&rsquo;s frontline teams, for the clinics and communities that
            need it most.
          </p>
          <div className="lp-grid">
            {FEATURES.map((f) => (
              <article className="lp-card" key={f.title}>
                <span className="lp-card-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-block lp-block--tight" id="impact">
          <div className="lp-impact">
            {[
              ['Always open', 'Care that does not keep clinic hours.'],
              ['First reply in minutes', 'Not days on a waiting list.'],
              ['Zero travel', 'A full consultation from a phone.'],
            ].map(([k, v]) => (
              <div className="lp-impact-item" key={k}>
                <strong>{k}</strong>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-cta" id="join">
          <h2>Join the HealthForGood network today.</h2>
          <p>
            Whether you&rsquo;re a patient looking for care or a doctor looking to give it — it takes
            a minute to sign up.
          </p>
          <div className="lp-cta-row">
            <button className="lp-btn lp-btn--light" onClick={goSignup}>
              <Stethoscope size={14} /> Sign up as a doctor <ArrowRight size={14} />
            </button>
            <button className="lp-btn lp-btn--solid" onClick={goSignup}>
              <Users size={14} /> Sign up as a patient <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <footer className="lp-footer">
          <span>© {new Date().getFullYear()} MyHospital · A HealthForGood NGO initiative</span>
          <span>HIPAA-aware · Built for clinics &amp; outreach teams</span>
        </footer>
      </main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap');

.lp-page {
  --teal: #4fd8c4;
  --teal-deep: #0e9c8f;
  --ink: #eef7f5;
  --ink-soft: #9db8b3;
  --vig: 0.5;
  min-height: 100vh;
  background: radial-gradient(125% 90% at 50% 12%, #0e504c 0%, #072e2c 68%);
  color: var(--ink);
  font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow-x: clip;
}
.lp-page *, .lp-page *::before, .lp-page *::after { box-sizing: border-box; }
.lp-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ---------------- Loader ---------------- */
.lp-loader {
  position: fixed; inset: 0; z-index: 100;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; background: #050f14;
  transition: opacity .8s ease, visibility .8s ease;
}
.lp-loader.is-done { opacity: 0; visibility: hidden; pointer-events: none; }
.lp-loader-mark {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #4fd8c4, #0e9c8f); color: #04201d;
  box-shadow: 0 10px 30px rgba(79, 216, 196, .28);
}
.lp-loader-word { font-family: 'Fraunces', serif; font-size: 20px; letter-spacing: .01em; color: #f2fbf9; }
.lp-loader-sub {
  font-size: 10px; letter-spacing: .34em; text-transform: uppercase; color: #6f9a95;
}
.lp-loader-bar {
  margin-top: 8px; width: 168px; height: 2px; border-radius: 2px;
  background: rgba(255, 255, 255, .1); overflow: hidden;
}
.lp-loader-bar span {
  display: block; height: 100%; transform-origin: left; transform: scaleX(.04);
  background: linear-gradient(90deg, #4fd8c4, #3fb6ff); transition: transform .3s ease;
}

/* ---------------- Nav ---------------- */
.lp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px clamp(20px, 4vw, 44px);
  transition: opacity .6s ease;
}
.lp-nav.is-dim { opacity: .32; }
.lp-brand {
  display: flex; align-items: center; gap: 9px;
  font-family: 'Fraunces', serif; font-size: 16px; color: #f2fbf9;
}
.lp-brand-mark {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #4fd8c4, #0e9c8f); color: #04201d;
}
.lp-nav-links { display: flex; align-items: center; gap: 22px; }
.lp-nav-links a {
  font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--ink-soft); text-decoration: none; transition: color .2s ease;
}
.lp-nav-links a:hover { color: var(--ink); }
.lp-nav-ghost {
  background: none; border: 0; cursor: pointer; color: var(--ink-soft);
  font: inherit; font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
  transition: color .2s ease;
}
.lp-nav-ghost:hover { color: var(--ink); }
.lp-nav-cta {
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  padding: 9px 15px; border-radius: 999px; border: 1px solid rgba(79, 216, 196, .4);
  background: rgba(79, 216, 196, .12); color: #bff3ea;
  transition: transform .2s ease, background .2s ease, border-color .2s ease;
}
.lp-nav-cta:hover { transform: translateY(-1px); background: rgba(79, 216, 196, .2); border-color: rgba(79, 216, 196, .7); }
.lp-nav-cta svg { transition: transform .2s ease; }
.lp-nav-cta:hover svg { transform: translateX(2px); }

/* ---------------- Cinematic act ---------------- */
.lp-scroll { position: relative; height: 560vh; }
.lp-sticky { position: sticky; top: 0; height: 100vh; overflow: hidden; }
.lp-canvas { position: absolute; inset: 0; z-index: 1; }
.lp-canvas canvas { display: block; width: 100% !important; height: 100% !important; }

.lp-overlay { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.lp-vignette {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  box-shadow: inset 0 0 clamp(120px, 24vw, 380px) rgba(0, 0, 0, calc(var(--vig) * 0.92));
  background: radial-gradient(120% 120% at 50% 45%, transparent 45%, rgba(0, 0, 0, calc(var(--vig) * 0.5)) 100%);
}

/* caption */
.lp-caption {
  position: absolute; left: clamp(22px, 6vw, 92px); top: 50%; transform: translateY(-50%);
  max-width: min(640px, 74vw);
}
.lp-caption-tag {
  display: block; margin-bottom: 18px; white-space: nowrap;
  font-size: 14px; letter-spacing: .2em; color: #7fdccb;
  opacity: 0; animation: lp-fade .6s ease .05s forwards;
}
.lp-caption-type { text-transform: none; }
.lp-caption-lines {
  margin: 0; display: flex; flex-direction: column;
  font-family: 'Fraunces', serif; font-weight: 500;
  font-size: clamp(32px, 6.6vw, 78px); line-height: 1.05; letter-spacing: -.012em;
  color: #f4fcfa;
}
.lp-caption-lines span {
  display: block; opacity: 0; transform: translateY(20px);
  animation: lp-rise .85s cubic-bezier(.22, .61, .36, 1) forwards;
}
@keyframes lp-fade { to { opacity: 1; } }
@keyframes lp-rise { to { opacity: 1; transform: none; } }

/* progress indicator */
.lp-progress {
  position: absolute; right: clamp(18px, 4vw, 54px); top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: flex-end; gap: 20px;
}
.lp-type-caret {
  display: inline-block; width: 2px; height: .95em; margin-left: 3px;
  vertical-align: -0.12em; background: #4fd8c4;
  animation: lp-caret 1s steps(1, end) infinite;
}
@keyframes lp-caret { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
.lp-progress-count { display: flex; align-items: baseline; gap: 6px; }
.lp-progress-num {
  font-family: 'Fraunces', serif; font-size: 30px; color: #f4fcfa;
  animation: lp-fade .5s ease;
}
.lp-progress-total { font-size: 11px; letter-spacing: .12em; color: #6f9a95; }
.lp-progress-rail { position: relative; display: flex; flex-direction: column; gap: 13px; }
.lp-progress-fill {
  position: absolute; right: -11px; top: 2px; bottom: 2px; width: 2px; border-radius: 2px;
  transform-origin: top; transform: scaleY(0);
  background: linear-gradient(#4fd8c4, #3fb6ff);
}
.lp-progress-tick {
  display: flex; align-items: center; justify-content: flex-end; gap: 9px;
  font-size: 9.5px; letter-spacing: .2em; text-transform: uppercase; color: #557d78;
  transition: color .4s ease;
}
.lp-progress-tick i {
  display: block; width: 16px; height: 1px; background: currentColor;
  transition: width .4s ease, background .4s ease;
}
.lp-progress-tick.is-on { color: #8ee6d5; }
.lp-progress-tick.is-on i { width: 30px; }

/* scroll hint */
.lp-hint {
  position: absolute; left: 50%; bottom: 32px; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  font-size: 9.5px; letter-spacing: .34em; text-transform: uppercase; color: #86a8a3;
  transition: opacity .6s ease;
}
.lp-hint.is-hidden { opacity: 0; }
.lp-hint i {
  width: 1px; height: 34px;
  background: linear-gradient(#86a8a3, transparent);
  animation: lp-hint 1.9s ease-in-out infinite;
}
@keyframes lp-hint {
  0%, 100% { transform: scaleY(.3); opacity: .4; transform-origin: top; }
  50% { transform: scaleY(1); opacity: 1; transform-origin: top; }
}

/* ---------------- Grounded content ---------------- */
.lp-grounded {
  position: relative; z-index: 5;
  background: linear-gradient(#0c3a31 0%, #08302a 100%);
  border-top: 1px solid rgba(255, 255, 255, .08);
}
.lp-block { max-width: 1080px; margin: 0 auto; padding: clamp(80px, 12vw, 150px) clamp(22px, 6vw, 40px); }
.lp-block--tight { padding-top: 0; }
.lp-eyebrow { font-size: 11px; letter-spacing: .28em; text-transform: uppercase; color: #7fdccb; margin: 0 0 16px; }
.lp-h2 {
  font-family: 'Fraunces', serif; font-weight: 500; font-size: clamp(26px, 4vw, 44px);
  line-height: 1.12; letter-spacing: -.01em; color: #f4fcfa; margin: 0 0 16px; max-width: 18ch;
}
.lp-lead { font-size: 15px; line-height: 1.7; color: var(--ink-soft); max-width: 52ch; margin: 0 0 48px; }
.lp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.lp-card {
  padding: 26px; border-radius: 18px;
  background: rgba(255, 255, 255, .03); border: 1px solid rgba(255, 255, 255, .08);
  transition: transform .25s ease, border-color .25s ease, background .25s ease;
}
.lp-card:hover { transform: translateY(-4px); border-color: rgba(79, 216, 196, .35); background: rgba(255, 255, 255, .05); }
.lp-card-icon {
  width: 38px; height: 38px; border-radius: 11px; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #4fd8c4, #0e9c8f); color: #04201d;
}
.lp-card h3 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 17px; color: #f2fbf9; margin: 0 0 8px; }
.lp-card p { font-size: 13px; line-height: 1.65; color: var(--ink-soft); margin: 0; }

.lp-impact {
  max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px; border-top: 1px solid rgba(255, 255, 255, .08); padding-top: 44px;
}
.lp-impact-item { display: flex; flex-direction: column; gap: 8px; }
.lp-impact-item strong {
  font-family: 'Fraunces', serif; font-weight: 500; font-size: 20px; color: #f4fcfa;
}
.lp-impact-item span { font-size: 13px; color: var(--ink-soft); }

.lp-cta {
  max-width: 900px; margin: 0 auto clamp(80px, 12vw, 150px); text-align: center;
  padding: clamp(40px, 7vw, 72px) clamp(22px, 6vw, 40px);
  border-radius: 26px;
  background: linear-gradient(135deg, rgba(79, 216, 196, .14), rgba(63, 182, 255, .08));
  border: 1px solid rgba(79, 216, 196, .22);
}
.lp-cta h2 {
  font-family: 'Fraunces', serif; font-weight: 500; font-size: clamp(24px, 3.6vw, 38px);
  color: #f4fcfa; margin: 0 0 12px;
}
.lp-cta p { font-size: 14px; line-height: 1.65; color: var(--ink-soft); margin: 0 auto 28px; max-width: 46ch; }
.lp-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.lp-btn {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font: inherit; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  padding: 13px 22px; border-radius: 999px; border: 1px solid transparent;
  transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
}
.lp-btn svg:last-child { transition: transform .2s ease; }
.lp-btn:hover svg:last-child { transform: translateX(3px); }
.lp-btn--solid { background: linear-gradient(135deg, #4fd8c4, #0e9c8f); color: #04201d; box-shadow: 0 14px 30px rgba(79, 216, 196, .28); }
.lp-btn--solid:hover { transform: translateY(-2px); box-shadow: 0 18px 38px rgba(79, 216, 196, .4); }
.lp-btn--light { background: #f4fcfa; color: #0b2b28; }
.lp-btn--light:hover { transform: translateY(-2px); box-shadow: 0 16px 32px rgba(0, 0, 0, .3); }

.lp-footer {
  max-width: 1080px; margin: 0 auto; padding: 26px clamp(22px, 6vw, 40px);
  border-top: 1px solid rgba(255, 255, 255, .06);
  display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  font-size: 11px; letter-spacing: .04em; color: #6f8f8a;
}

/* ---------------- Responsive ---------------- */
@media (max-width: 820px) {
  .lp-scroll { height: 520vh; }
  .lp-nav-links a { display: none; }
  .lp-caption { top: auto; bottom: 128px; transform: none; }
  .lp-progress { top: 74px; bottom: auto; transform: none; }
  .lp-caption-tag { font-size: 12px; letter-spacing: .16em; }
  .lp-progress-tick em { display: none; }
  .lp-progress-tick i { width: 12px; }
  .lp-progress-tick.is-on i { width: 20px; }
  .lp-grid, .lp-impact { grid-template-columns: 1fr; }
}

/* ---------------- Reduced motion ---------------- */
@media (prefers-reduced-motion: reduce) {
  .lp-page *,
  .lp-page *::before,
  .lp-page *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .lp-caption-tag, .lp-caption-lines span { opacity: 1 !important; transform: none !important; }
  .lp-hint i { animation: none; }
}
`;

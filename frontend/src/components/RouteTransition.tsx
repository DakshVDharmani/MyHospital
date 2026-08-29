import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';

/**
 * App-wide branded route transition. Instead of a hard cut between pages, a
 * three-layer deep-teal curtain sweeps up to cover the screen, the route
 * changes underneath it, then the curtain sweeps off the top — one continuous
 * motion. Call `go(path)` from anywhere via `useRouteTransition()`.
 */

type Ctx = { go: (to: string) => void };

const TransitionCtx = createContext<Ctx>({
  go: (to) => {
    window.location.href = to;
  },
});

export const useRouteTransition = () => useContext(TransitionCtx);

const COVER_MS = 680; // curtain fully covers the screen
const REVEAL_MS = 740; // curtain clears off the top

type Phase = 'idle' | 'cover' | 'reveal';

export function RouteTransition({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>('idle');
  const pending = useRef<string | null>(null);

  const go = useCallback(
    (to: string) => {
      if (to === location.pathname) return;
      if (phase !== 'idle') return;
      pending.current = to;
      setPhase('cover');
    },
    [location.pathname, phase],
  );

  useEffect(() => {
    if (phase === 'cover') {
      const t = setTimeout(() => {
        if (pending.current) {
          navigate(pending.current);
          pending.current = null;
        }
        window.scrollTo(0, 0);
        setPhase('reveal');
      }, COVER_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'reveal') {
      const t = setTimeout(() => setPhase('idle'), REVEAL_MS);
      return () => clearTimeout(t);
    }
  }, [phase, navigate]);

  return (
    <TransitionCtx.Provider value={{ go }}>
      {children}
      <div className={`rt-curtain rt-${phase}`} role="presentation" aria-hidden="true">
        <span className="rt-panel" />
        <span className="rt-panel" />
        <span className="rt-panel" />
        <div className="rt-mark">
          <i>
            <HeartPulse size={18} strokeWidth={2.5} />
          </i>
          <em>MyHospital</em>
        </div>
      </div>
      <style>{CURTAIN_CSS}</style>
    </TransitionCtx.Provider>
  );
}

const CURTAIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap');

.rt-curtain {
  position: fixed; inset: 0; z-index: 9999;
  pointer-events: none; overflow: hidden;
}
.rt-curtain.rt-cover { pointer-events: all; }

.rt-panel {
  position: absolute; top: -3%; left: -2%; width: 104%; height: 106%;
  transform: translateY(106%); will-change: transform;
}
.rt-panel:nth-child(1) { background: #06322F; }
.rt-panel:nth-child(2) { background: #0A4744; }
.rt-panel:nth-child(3) {
  background: linear-gradient(160deg, #0E5C58 0%, #0B4B47 100%);
  box-shadow: 0 -2px 46px rgba(96, 232, 212, .28), inset 0 3px 0 rgba(128, 244, 224, .55);
}

.rt-cover .rt-panel {
  transform: translateY(0);
  transition: transform .55s cubic-bezier(.76, 0, .24, 1);
}
.rt-cover .rt-panel:nth-child(2) { transition-delay: .06s; }
.rt-cover .rt-panel:nth-child(3) { transition-delay: .12s; }

.rt-reveal .rt-panel {
  transform: translateY(-106%);
  transition: transform .62s cubic-bezier(.76, 0, .24, 1);
}
.rt-reveal .rt-panel:nth-child(2) { transition-delay: .05s; }
.rt-reveal .rt-panel:nth-child(3) { transition-delay: .1s; }

.rt-idle .rt-panel { transition: none; transform: translateY(106%); }

.rt-mark {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  color: #eafffb; opacity: 0; transform: translateY(10px);
}
.rt-mark i {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #34d6c4, #0e7e75); color: #04211e;
  box-shadow: 0 8px 24px rgba(52, 214, 196, .32);
}
.rt-mark em {
  font-family: 'Fraunces', Georgia, serif; font-style: normal; font-weight: 600;
  font-size: 20px; letter-spacing: .01em;
}
.rt-cover .rt-mark {
  opacity: 1; transform: none;
  transition: opacity .4s ease .16s, transform .5s cubic-bezier(.22, .61, .36, 1) .16s;
}
.rt-reveal .rt-mark {
  opacity: 0; transform: translateY(-10px);
  transition: opacity .28s ease, transform .28s ease;
}

@media (prefers-reduced-motion: reduce) {
  .rt-panel { transform: none !important; opacity: 0; }
  .rt-cover .rt-panel,
  .rt-reveal .rt-panel,
  .rt-idle .rt-panel { transition: opacity .22s ease !important; transform: none !important; }
  .rt-cover .rt-panel { opacity: 1; }
  .rt-reveal .rt-panel,
  .rt-idle .rt-panel { opacity: 0; }
}
`;

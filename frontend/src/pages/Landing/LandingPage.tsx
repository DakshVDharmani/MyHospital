import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  Users,
  MessageSquare,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { StethoscopeScene } from './StethoscopeScene';

const FEATURES = [
  {
    icon: <MessageSquare size={20} />,
    title: 'Secure messaging',
    body: 'Patients and doctors talk directly — no clinic visit required for a quick question or a follow-up.',
  },
  {
    icon: <Activity size={20} />,
    title: 'Care that prioritizes itself',
    body: 'Doctors see who needs them first, automatically — critical cases never wait behind routine ones.',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'Built for trust',
    body: 'HIPAA-aware by design, with every record and message kept private between patient and care team.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);

  // Drives the hero model's transform from ordinary page scroll — no pinning,
  // no scroll-jacking. Progress goes 0 -> 1 continuously as the hero section
  // travels through the viewport (0 when its top just enters at the bottom,
  // 1 when its bottom exits at the top), so the page always keeps scrolling
  // and the model animation is just a parallax layer riding along with it.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = heroRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const total = rect.height + window.innerHeight;
        const traveled = window.innerHeight - rect.top;
        progressRef.current = total > 0 ? Math.max(0, Math.min(1, traveled / total)) : 0;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="lp-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');

        .lp-page {
          --teal: #0E9C8F;
          --teal-deep: #0B7A70;
          --navy: #0B2B3C;
          --navy-soft: #4C6B78;
          --ink: #10262E;
          --ink-soft: #5C7680;
          --bg: #F6FAF9;
          --line: #D6E8E3;
          --accent: #2C7FF2;
          --ease: cubic-bezier(.22,.61,.36,1);

          background: var(--bg);
          color: var(--ink);
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .lp-page *, .lp-page *::before, .lp-page *::after { box-sizing: border-box; }

        /* ---------------- Nav ---------------- */
        .lp-nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 40px;
          background: rgba(246, 250, 249, 0.82);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid var(--line);
        }
        .lp-brand { display: flex; align-items: center; gap: 10px; }
        .lp-brand-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%);
          color: #fff; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 10px rgba(14, 156, 143, 0.3);
        }
        .lp-brand-name { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 17px; color: var(--navy); }
        .lp-nav-actions { display: flex; align-items: center; gap: 10px; }
        .lp-btn {
          font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 13px;
          padding: 9px 18px; border-radius: 10px; cursor: pointer; border: none;
          transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease), background 0.18s var(--ease), border-color 0.18s var(--ease);
        }
        .lp-btn-ghost { background: transparent; color: var(--navy); border: 1.5px solid var(--line); }
        .lp-btn-ghost:hover { border-color: var(--teal); color: var(--teal-deep); }
        .lp-btn-solid {
          background: linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%); color: #fff;
          box-shadow: 0 10px 22px rgba(14, 156, 143, 0.28);
          display: inline-flex; align-items: center; gap: 7px;
        }
        .lp-btn-solid:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(14, 156, 143, 0.36); }

        /* ---------------- Hero (no pin — normal document flow, model is a
           blurred backdrop layer whose transform tracks scroll progress) --- */
        .lp-hero {
          position: relative;
          min-height: 100vh;
          display: flex; align-items: center;
          overflow: hidden;
        }
        .lp-hero::before {
          content: '';
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(14,156,143,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,156,143,0.05) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(80% 70% at 15% 45%, black 30%, transparent 85%);
          pointer-events: none;
        }
        .lp-hero-model {
          position: absolute; inset: 0; z-index: 1;
          filter: blur(3px);
          opacity: 0.5;
        }
        .lp-hero-text {
          position: relative; z-index: 2;
          max-width: 480px;
          padding: 0 6vw;
        }
        .lp-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase;
          color: var(--teal-deep);
          background: rgba(14,156,143,0.1); border: 1px solid rgba(14,156,143,0.22);
          padding: 6px 12px; border-radius: 999px;
          margin-bottom: 18px;
        }
        .lp-hero-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); }
        .lp-hero-title {
          font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 40px; line-height: 1.15;
          color: var(--navy); margin: 0 0 18px;
        }
        .lp-hero-body {
          font-size: 15px; line-height: 1.7; color: var(--ink-soft); font-weight: 500;
          margin: 0 0 28px;
        }
        .lp-hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; }

        @media (max-width: 860px) {
          .lp-hero-title { font-size: 30px; }
          .lp-hero-text { max-width: 92vw; }
        }

        /* ---------------- Sections below the fold ---------------- */
        .lp-section { padding: 90px 8vw; }
        .lp-section-head { max-width: 620px; margin: 0 auto 48px; text-align: center; }
        .lp-section-eyebrow {
          font-size: 11px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase;
          color: var(--teal-deep); margin-bottom: 10px;
        }
        .lp-section-title { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 28px; color: var(--navy); margin: 0 0 10px; }
        .lp-section-sub { font-size: 14px; color: var(--ink-soft); font-weight: 500; line-height: 1.6; }

        .lp-feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; max-width: 1080px; margin: 0 auto; }
        @media (max-width: 860px) { .lp-feature-grid { grid-template-columns: 1fr; } }
        .lp-feature-card {
          background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 26px;
          transition: transform 0.22s var(--ease), box-shadow 0.22s var(--ease);
        }
        .lp-feature-card:hover { transform: translateY(-4px); box-shadow: 0 18px 36px rgba(6, 34, 32, 0.08); }
        .lp-feature-icon {
          width: 42px; height: 42px; border-radius: 12px; margin-bottom: 16px;
          background: linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%); color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 16px rgba(14, 156, 143, 0.24);
        }
        .lp-feature-title { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 16px; color: var(--navy); margin: 0 0 8px; }
        .lp-feature-body { font-size: 13px; color: var(--ink-soft); font-weight: 500; line-height: 1.6; margin: 0; }

        .lp-cta-band {
          margin: 0 8vw 90px;
          border-radius: 24px;
          padding: 56px 8vw;
          background: linear-gradient(120deg, #0F8F84 0%, #0B6E67 100%);
          color: #fff;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .lp-cta-band::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(120% 140% at 85% 0%, rgba(110, 240, 200, 0.28) 0%, rgba(110, 240, 200, 0) 55%);
          pointer-events: none;
        }
        .lp-cta-band > * { position: relative; z-index: 1; }
        .lp-cta-title { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 26px; margin: 0 0 12px; }
        .lp-cta-sub { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.86); margin: 0 0 26px; }

        .lp-footer {
          padding: 28px 8vw; border-top: 1px solid var(--line);
          display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          font-size: 12px; color: var(--ink-soft); font-weight: 600;
        }
      `}</style>

      <nav className="lp-nav">
        <div className="lp-brand">
          <div className="lp-brand-icon"><HeartPulse size={18} strokeWidth={2.3} /></div>
          <span className="lp-brand-name">MyHospital</span>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-btn lp-btn-ghost" onClick={() => navigate('/login')}>Log in</button>
          <button className="lp-btn lp-btn-solid" onClick={() => navigate('/signup')}>
            Sign up <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      <section className="lp-hero" ref={heroRef}>
        <div className="lp-hero-model">
          <StethoscopeScene progressRef={progressRef} />
        </div>

        <div className="lp-hero-text">
          <span className="lp-hero-eyebrow"><span className="lp-hero-eyebrow-dot" /> HealthForGood NGO</span>
          <h1 className="lp-hero-title">Care that shows up on time — wherever you are.</h1>
          <p className="lp-hero-body">
            HealthForGood exists because quality care shouldn't depend on your zip code. We connect patients in
            underserved communities with licensed doctors and nurses — real consultations, real records, real
            follow-up care — all from a phone. No waiting rooms, no travel, no gatekeeping.
          </p>
          <div className="lp-hero-ctas">
            <button className="lp-btn lp-btn-solid" onClick={() => navigate('/signup')}>
              Get started <ArrowRight size={14} />
            </button>
            <button className="lp-btn lp-btn-ghost" onClick={() => navigate('/login')}>I already have an account</button>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <div className="lp-section-eyebrow">Why MyHospital</div>
          <h2 className="lp-section-title">One place for patients and doctors to actually connect</h2>
          <p className="lp-section-sub">Built with HealthForGood's frontline teams, for the clinics and communities that need it most.</p>
        </div>
        <div className="lp-feature-grid">
          {FEATURES.map((f) => (
            <div className="lp-feature-card" key={f.title}>
              <div className="lp-feature-icon">{f.icon}</div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-cta-band">
        <h2 className="lp-cta-title">Join the HealthForGood network today.</h2>
        <p className="lp-cta-sub">Whether you're a patient looking for care or a doctor looking to give it — it takes a minute to sign up.</p>
        <div className="lp-hero-ctas" style={{ justifyContent: 'center' }}>
          <button className="lp-btn lp-btn-solid" style={{ background: '#fff', color: 'var(--teal-deep)', boxShadow: '0 10px 22px rgba(0,0,0,0.16)' }} onClick={() => navigate('/signup')}>
            <Stethoscope size={14} /> Sign up as a doctor <ArrowRight size={14} />
          </button>
          <button className="lp-btn lp-btn-solid" onClick={() => navigate('/signup')}>
            <Users size={14} /> Sign up as a patient <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} MyHospital · A HealthForGood NGO initiative</span>
        <span>HIPAA-aware · Built for clinics &amp; outreach teams</span>
      </footer>
    </div>
  );
}
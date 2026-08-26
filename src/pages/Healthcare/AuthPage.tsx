import { useCallback, useEffect, useRef, useState } from 'react';
import { HeartPulse, Stethoscope, ShieldCheck } from 'lucide-react';
import { HealthcareScene, type Activity } from './Scene';
import { AuthForm, type AuthSubmitPayload } from './AuthForm';
import type { Mode } from './AuthForm';
import { supabase } from '../../lib/supabaseClient';

// TODO: point this at the real destination once it's linked.
const NEXT_PAGE_URL = '/healthcare/login';

export default function HealthcareAuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [loggingIn, setLoggingIn] = useState(false);
  const [pageFadeOut, setPageFadeOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const activityRef = useRef<Activity>({ lastActivity: 0, passwordActive: false });

  const markActivity = useCallback(() => {
    activityRef.current.lastActivity = performance.now();
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity);
    return () => {
      window.removeEventListener('pointermove', markActivity);
      window.removeEventListener('keydown', markActivity);
    };
  }, [markActivity]);

  const handleSubmit = useCallback(async (payload: AuthSubmitPayload) => {
    if (submitting) return;
    setAuthError(null);
    setSubmitting(true);

    try {
      if (payload.mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: { data: { name: payload.name, role: payload.role } },
        });
        if (error) throw error;

        // If email confirmation is off, we get a session immediately and can
        // create the profile row now. Otherwise it's created on first login.
        if (data.session && data.user) {
          const { error: profileError } = await supabase.from('users').upsert({
            id: data.user.id,
            name: payload.name,
            email: payload.email,
            role: payload.role,
          });
          if (profileError) throw profileError;
        } else {
          setSubmitting(false);
          setAuthError('Check your email to confirm your account, then log in.');
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: payload.email,
          password: payload.password,
        });
        if (error) throw error;

        const user = data.user;
        const role = (user.user_metadata?.role as AuthSubmitPayload['role']) ?? payload.role;
        const name = (user.user_metadata?.name as string) ?? payload.email;
        const { error: profileError } = await supabase.from('users').upsert({
          id: user.id,
          name,
          email: user.email ?? payload.email,
          role,
        });
        if (profileError) throw profileError;
      }

      setLoggingIn(true);
    } catch (err) {
      setSubmitting(false);
      setAuthError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }, [submitting]);

  const handleDriveOffDone = useCallback(() => {
    setPageFadeOut(true);
    window.setTimeout(() => {
      window.location.href = NEXT_PAGE_URL;
    }, 420);
  }, []);

  const switchMode = (next: Mode) => {
    setAuthError(null);
    setMode(next);
  };

  return (
    <div className={`hc-page ${pageFadeOut ? 'hc-page-fade-out' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');

        .hc-page {
          --teal: #0E9C8F;
          --teal-deep: #0B7A70;
          --navy: #0B2B3C;
          --navy-soft: #4C6B78;
          --ink: #10262E;
          --ink-soft: #5C7680;
          --bg: #F4FAF9;
          --card-bg: #FFFFFF;
          --field-bg: #F2F8F7;
          --line: #DCEBE8;
          --accent: #2C7FF2;
          --accent-deep: #1E63C9;
          --danger: #E5544A;
          --ease: cubic-bezier(.22,.61,.36,1);

          min-height: 100vh;
          width: 100%;
          display: flex;
          background:
            radial-gradient(120% 90% at 15% 0%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 45%),
            linear-gradient(90deg, #0F8F84 0%, #0B6E67 100%);
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
          overflow: hidden;
          position: relative;
        }
        .hc-page *, .hc-page *::before, .hc-page *::after { box-sizing: border-box; }
        .hc-page::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(140% 100% at 50% 40%, black 35%, transparent 90%);
          pointer-events: none;
        }
        .hc-page::after {
          content: '';
          position: absolute;
          top: -12%;
          right: -8%;
          width: 46%;
          height: 60%;
          background: radial-gradient(ellipse at center, rgba(110, 240, 200, 0.22) 0%, transparent 70%);
          filter: blur(10px);
          pointer-events: none;
          z-index: 0;
        }

        .hc-half {
          width: 50%;
          height: 100vh;
          position: relative;
          z-index: 1;
        }

        .hc-success {
          text-align: center;
          padding: 20px 0;
        }
        .hc-success-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(14, 156, 143, 0.12);
          color: var(--teal-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 18px;
        }
        .hc-success .hc-form-sub { margin-bottom: 26px; }

        /* ---------------- Left half: 3D visual ---------------- */
        .hc-visual {
          overflow: hidden;
        }
        .hc-page { transition: opacity 0.4s ease; }
        .hc-page.hc-page-fade-out { opacity: 0; pointer-events: none; }
        .hc-visual-glow {
          position: absolute;
          bottom: -18%;
          left: 50%;
          transform: translateX(-50%);
          width: 120%;
          height: 55%;
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.16) 0%, transparent 68%);
          pointer-events: none;
        }
        .hc-form-half::before { display: none; }
        .hc-visual-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(0deg, rgba(6, 34, 32, 0.72) 0%, rgba(6, 34, 32, 0.42) 32%, rgba(6, 34, 32, 0) 58%);
          pointer-events: none;
          z-index: 2;
        }
        /* Matching bottom-darkening on the right half so it isn't lighter than the left. */
        .hc-page-wash {
          position: absolute;
          inset: 0;
          background: linear-gradient(0deg, rgba(6, 34, 32, 0.72) 0%, rgba(6, 34, 32, 0.42) 32%, rgba(6, 34, 32, 0) 58%);
          pointer-events: none;
          z-index: 0;
        }

        .hc-brand {
          position: absolute;
          top: 40px;
          left: 44px;
          right: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 3;
          color: #fff;
        }
        .hc-brand-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(6px);
        }
        .hc-brand-name {
          font-family: 'Fraunces', 'Manrope', serif;
          font-weight: 600;
          font-size: 18px;
          letter-spacing: 0.2px;
        }

        .hc-visual-copy {
          position: absolute;
          left: 44px;
          right: 44px;
          bottom: 132px;
          z-index: 3;
          color: #fff;
        }
        .hc-visual-copy h1 {
          font-family: 'Fraunces', 'Manrope', serif;
          font-weight: 600;
          font-size: 32px;
          line-height: 1.18;
          margin: 0 0 10px;
          max-width: 380px;
          text-shadow: 0 2px 18px rgba(0,0,0,0.12);
        }
        .hc-visual-copy p {
          font-size: 14px;
          font-weight: 500;
          line-height: 1.6;
          color: rgba(255,255,255,0.86);
          max-width: 340px;
          margin: 0;
        }

        .hc-status-pill {
          position: absolute;
          left: 44px;
          bottom: 78px;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px 8px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.14);
          border: 1px solid rgba(255,255,255,0.24);
          backdrop-filter: blur(8px);
          color: #fff;
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.2px;
          transition: background 0.3s var(--ease);
        }
        .hc-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #6EF0C8;
          box-shadow: 0 0 0 3px rgba(110, 240, 200, 0.25);
        }

        .hc-trust-row {
          position: absolute;
          left: 44px;
          right: 44px;
          bottom: 32px;
          z-index: 3;
          display: flex;
          gap: 22px;
        }
        .hc-trust-item {
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(255,255,255,0.78);
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.2px;
        }

        /* ---------------- Right half: floating form card ---------------- */
        .hc-form-half {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
          z-index: 20;
        }
        .hc-form-half::before {
          content: '';
          position: absolute;
          bottom: -10%;
          left: -14%;
          width: 55%;
          height: 50%;
          background: radial-gradient(ellipse at center, rgba(44, 127, 242, 0.14) 0%, transparent 72%);
          pointer-events: none;
        }

        .hc-form-card-wrap {
          width: 100%;
          max-width: 400px;
          position: relative;
          isolation: isolate;
        }
        .hc-form-card-wrap::before {
          content: '';
          position: absolute;
          inset: -1.5px;
          border-radius: 27px;
          background: linear-gradient(135deg, rgba(110, 240, 200, 0.65), rgba(44, 127, 242, 0.35) 45%, rgba(255,255,255,0) 75%);
          opacity: 0;
          transition: opacity 0.35s var(--ease);
          z-index: -1;
        }
        .hc-form-card-wrap:hover::before { opacity: 1; }

        .hc-form-inner {
          width: 100%;
          background: rgba(255, 255, 255, 0.97);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 26px;
          padding: 24px 28px;
          box-shadow:
            0 1px 1px rgba(11, 43, 60, 0.03),
            0 12px 32px rgba(6, 34, 32, 0.16),
            0 28px 64px rgba(6, 34, 32, 0.14);
          transition: transform 0.4s var(--ease), box-shadow 0.4s var(--ease);
        }
        .hc-form-card-wrap:hover .hc-form-inner {
          transform: translateY(-5px);
          box-shadow:
            0 1px 1px rgba(11, 43, 60, 0.04),
            0 18px 40px rgba(6, 34, 32, 0.2),
            0 36px 80px rgba(6, 34, 32, 0.18);
        }

        .hc-tabs {
          display: flex;
          background: var(--field-bg);
          border-radius: 999px;
          padding: 4px;
          margin-bottom: 14px;
        }
        .hc-tab {
          flex: 1;
          border: none;
          background: transparent;
          padding: 9px 0;
          border-radius: 999px;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 12px;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.28s var(--ease), color 0.28s var(--ease), box-shadow 0.28s var(--ease);
        }
        .hc-tab.hc-tab-active {
          background: #fff;
          color: var(--teal-deep);
          box-shadow: 0 4px 14px rgba(11, 43, 60, 0.12);
        }

        .hc-role-toggle {
          display: flex;
          gap: 8px;
          margin: 0 0 10px;
        }
        .hc-role-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1.5px solid var(--line);
          background: var(--field-bg);
          padding: 6px 0;
          border-radius: 10px;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 12px;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.22s var(--ease), color 0.22s var(--ease), border-color 0.22s var(--ease);
        }
        .hc-role-btn svg { flex-shrink: 0; }
        .hc-role-btn.hc-role-btn-active {
          background: rgba(14, 156, 143, 0.1);
          border-color: var(--teal);
          color: var(--teal-deep);
        }

        .hc-form-title {
          font-family: 'Fraunces', 'Manrope', serif;
          font-weight: 600;
          font-size: 20px;
          color: var(--navy);
          margin: 0 0 3px;
        }
        .hc-form-sub {
          font-size: 12.5px;
          color: var(--ink-soft);
          font-weight: 500;
          margin: 0 0 12px;
        }

        .hc-quote {
          margin: 0 0 12px;
          padding: 8px 10px;
          border-left: 2.5px solid var(--teal);
          background: var(--field-bg);
          border-radius: 0 10px 10px 0;
          font-family: 'Fraunces', 'Manrope', serif;
          font-style: italic;
          font-size: 11px;
          line-height: 1.4;
          color: var(--navy-soft);
        }
        .hc-quote span {
          display: block;
          margin-top: 4px;
          font-family: 'Manrope', sans-serif;
          font-style: normal;
          font-weight: 700;
          font-size: 10.5px;
          color: var(--teal-deep);
        }

        .hc-field-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: var(--navy-soft);
          margin: 0 0 4px 2px;
          letter-spacing: 0.15px;
        }
        .hc-field {
          display: flex;
          align-items: center;
          gap: 9px;
          background: var(--field-bg);
          border: 1.5px solid var(--line);
          border-radius: 11px;
          padding: 8px 12px;
          margin-bottom: 8px;
          transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
        }
        .hc-field-name {
          /* Balances the login-only quote block so the login and signup cards render at the same height. */
          margin-bottom: 20px;
        }
        .hc-field.hc-focused {
          border-color: var(--teal);
          box-shadow: 0 0 0 4px rgba(14, 156, 143, 0.12);
          background: #fff;
        }
        .hc-field svg { flex-shrink: 0; color: #7C9A9A; }
        .hc-field.hc-focused svg { color: var(--teal-deep); }
        .hc-field input {
          border: none;
          background: transparent;
          outline: none;
          font-size: 13px;
          font-family: 'Manrope', sans-serif;
          font-weight: 600;
          color: var(--ink);
          width: 100%;
        }
        .hc-field input::placeholder { color: #9BB0AE; font-weight: 500; }

        .hc-eye-toggle {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #7C9A9A;
          display: flex;
          align-items: center;
          transition: color 0.2s var(--ease);
        }
        .hc-eye-toggle:hover { color: var(--teal-deep); }

        .hc-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: -2px 0 12px;
        }
        .hc-remember {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-soft);
          cursor: pointer;
        }
        .hc-remember input { accent-color: var(--teal); }
        .hc-forgot {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--accent);
          cursor: pointer;
        }
        .hc-forgot:hover { text-decoration: underline; }

        .hc-submit {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 11px;
          background: linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%);
          color: #fff;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 13.5px;
          letter-spacing: 0.2px;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(14, 156, 143, 0.28);
          transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease);
        }
        .hc-submit:hover { transform: translateY(-2px); box-shadow: 0 16px 30px rgba(14, 156, 143, 0.36); }
        .hc-submit:active { transform: translateY(0); }
        .hc-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        .hc-error {
          margin: -2px 0 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--danger);
        }

        .hc-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 12px 0 10px;
        }
        .hc-divider::before, .hc-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--line);
        }
        .hc-divider span {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--ink-soft);
          white-space: nowrap;
        }

        .hc-social-row {
          display: flex;
          gap: 12px;
        }
        .hc-social-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 38px;
          border-radius: 12px;
          border: 1.5px solid var(--line);
          background: #fff;
          color: var(--ink);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.18s var(--ease), border-color 0.18s var(--ease);
        }
        .hc-social-btn:hover { transform: translateY(-2px); border-color: var(--teal); }

        .hc-switch-note {
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-soft);
          margin-top: 12px;
        }
        .hc-switch-note button {
          background: none;
          border: none;
          color: var(--teal-deep);
          font-weight: 800;
          cursor: pointer;
          padding: 0;
          margin-left: 4px;
        }
        .hc-switch-note button:hover { text-decoration: underline; }

        @media (max-width: 860px) {
          .hc-page { flex-direction: column; height: auto; min-height: 100vh; overflow-y: auto; overflow-x: hidden; }
          .hc-half { width: 100%; height: auto; }
          .hc-visual { height: 64vh; min-height: 460px; position: relative; }
          .hc-visual-copy { bottom: 128px; left: 28px; right: 28px; }
          .hc-visual-copy h1 { font-size: 24px; max-width: none; }
          .hc-visual-copy p { max-width: none; }
          .hc-status-pill { left: 28px; }
          .hc-trust-row { left: 28px; right: 28px; }
          .hc-form-half { padding: 32px 24px 56px; }
        }
      `}</style>

      <div className="hc-half hc-visual">
        <HealthcareScene activityRef={activityRef} driving={loggingIn} onDriveOffDone={handleDriveOffDone} />
        <div className="hc-visual-glow" />
        <div className="hc-visual-scrim" />

        <div className="hc-brand">
          <div className="hc-brand-icon">
            <HeartPulse size={19} strokeWidth={2.3} />
          </div>
          <span className="hc-brand-name">MyHospital</span>
        </div>

        <div className="hc-visual-copy">
          <h1>{mode === 'login' ? 'Care that shows up on time.' : 'Join the HealthForGood network.'}</h1>
          <p>
            {mode === 'login'
              ? 'Sign in as a doctor or patient to connect with your HealthForGood care team.'
              : 'Create a doctor or patient account and start using MyHospital in minutes.'}
          </p>
        </div>

        <div className="hc-status-pill">
          <span className="hc-status-dot" />
          Care team online
        </div>

        <div className="hc-trust-row">
          <div className="hc-trust-item"><ShieldCheck size={14} /> HIPAA-aware</div>
          <div className="hc-trust-item"><Stethoscope size={14} /> Powered by HealthForGood NGO</div>
        </div>
      </div>

      <div className="hc-half hc-form-half">
        <div className="hc-page-wash" />
        <div className="hc-form-card-wrap">
          <AuthForm
            mode={mode}
            switchMode={switchMode}
            activityRef={activityRef}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={authError}
          />
        </div>
      </div>
    </div>
  );
}

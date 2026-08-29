import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Stethoscope, HeartPulse } from 'lucide-react';
import type { Activity } from './Scene';

/** Google's four-colour "G" mark. */
function GoogleIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 3-2.26 5.54-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export type Mode = 'login' | 'signup';
export type Role = 'patient' | 'doctor';

export type AuthSubmitPayload = {
  mode: Mode;
  role: Role;
  name: string;
  email: string;
  password: string;
};

export function AuthForm({
  mode,
  switchMode,
  activityRef,
  onSubmit,
  onGoogle,
  submitting = false,
  error = null,
}: {
  mode: Mode;
  switchMode: (next: Mode) => void;
  activityRef: React.RefObject<Activity>;
  onSubmit: (payload: AuthSubmitPayload) => void;
  onGoogle: (role: Role) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ mode, role, name, email, password });
  };

  return (
    <div className="hc-form-inner">
      <div className="hc-tabs">
        <button
          type="button"
          className={`hc-tab ${mode === 'login' ? 'hc-tab-active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Log In
        </button>
        <button
          type="button"
          className={`hc-tab ${mode === 'signup' ? 'hc-tab-active' : ''}`}
          onClick={() => switchMode('signup')}
        >
          Sign Up
        </button>
      </div>

      <h2 className="hc-form-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
      <p className="hc-form-sub">
        {mode === 'login' ? 'Sign in to your MyHospital portal.' : 'Set up your MyHospital account in under a minute.'}
      </p>

      <label className="hc-field-label">I am a</label>
      <div className="hc-role-toggle">
        <button
          type="button"
          className={`hc-role-btn ${role === 'patient' ? 'hc-role-btn-active' : ''}`}
          onClick={() => setRole('patient')}
        >
          <HeartPulse size={14} /> Patient
        </button>
        <button
          type="button"
          className={`hc-role-btn ${role === 'doctor' ? 'hc-role-btn-active' : ''}`}
          onClick={() => setRole('doctor')}
        >
          <Stethoscope size={14} /> Doctor
        </button>
      </div>

      {mode === 'login' && (
        <div className="hc-quote">
          &ldquo;The good physician treats the disease; the great physician treats the patient who has the disease.&rdquo;
          <span>— Sir William Osler</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {mode === 'signup' && (
          <>
            <label className="hc-field-label" htmlFor="hc-name">Full name</label>
            <label className={`hc-field hc-field-name ${focusedField === 'name' ? 'hc-focused' : ''}`}>
              <User size={16} />
              <input
                id="hc-name"
                type="text"
                placeholder={role === 'doctor' ? 'Dr. Jane Alabi' : 'Jane Alabi'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                autoComplete="name"
              />
            </label>
          </>
        )}

        <label className="hc-field-label" htmlFor="hc-email">Email address</label>
        <label className={`hc-field ${focusedField === 'email' ? 'hc-focused' : ''}`}>
          <Mail size={16} />
          <input
            id="hc-email"
            type="email"
            placeholder="you@myhospital.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            autoComplete="email"
          />
        </label>

        <label className="hc-field-label" htmlFor="hc-password">Password</label>
        <label className={`hc-field ${focusedField === 'password' ? 'hc-focused' : ''}`}>
          <Lock size={16} />
          <input
            id="hc-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => {
              setFocusedField('password');
              activityRef.current.passwordActive = true;
            }}
            onBlur={() => {
              setFocusedField(null);
              activityRef.current.passwordActive = false;
            }}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <button
            type="button"
            className="hc-eye-toggle"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </label>

        {mode === 'login' ? (
          <div className="hc-row">
            <label className="hc-remember">
              <input type="checkbox" /> Remember me
            </label>
            <a className="hc-forgot" role="button" tabIndex={0}>Forgot password?</a>
          </div>
        ) : (
          <div className="hc-row">
            <label className="hc-remember">
              <input type="checkbox" defaultChecked /> I agree to the terms of care
            </label>
          </div>
        )}

        {error && <p className="hc-error">{error}</p>}

        <button type="submit" className="hc-submit" disabled={submitting}>
          {submitting
            ? 'Please wait…'
            : mode === 'login'
              ? `Log In as ${role === 'doctor' ? 'Doctor' : 'Patient'}`
              : `Create ${role === 'doctor' ? 'Doctor' : 'Patient'} Account`}
        </button>
      </form>

      <div className="hc-divider"><span>OR CONTINUE WITH</span></div>
      <button
        type="button"
        className="hc-social-btn hc-social-btn-google"
        onClick={() => onGoogle(role)}
        disabled={submitting}
      >
        <GoogleIcon size={18} /> Continue with Google
      </button>

      <p className="hc-switch-note">
        {mode === 'login' ? "New to MyHospital?" : 'Already have an account?'}
        <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </div>
  );
}

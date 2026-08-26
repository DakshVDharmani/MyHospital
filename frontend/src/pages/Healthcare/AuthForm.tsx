import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Chrome, Facebook, Stethoscope, HeartPulse } from 'lucide-react';
import type { Activity } from './Scene';

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
  submitting = false,
  error = null,
}: {
  mode: Mode;
  switchMode: (next: Mode) => void;
  activityRef: React.RefObject<Activity>;
  onSubmit: (payload: AuthSubmitPayload) => void;
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
      <div className="hc-social-row">
        <button type="button" className="hc-social-btn"><Chrome size={15} /> Google</button>
        <button type="button" className="hc-social-btn"><Facebook size={15} /> Facebook</button>
      </div>

      <p className="hc-switch-note">
        {mode === 'login' ? "New to MyHospital?" : 'Already have an account?'}
        <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </div>
  );
}

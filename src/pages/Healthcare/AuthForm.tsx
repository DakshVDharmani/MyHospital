import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Chrome, Facebook } from 'lucide-react';
import type { Activity } from './Scene';

export type Mode = 'login' | 'signup';

export function AuthForm({
  mode,
  switchMode,
  activityRef,
  onSubmit,
}: {
  mode: Mode;
  switchMode: (next: Mode) => void;
  activityRef: React.RefObject<Activity>;
  onSubmit: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
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
        {mode === 'login' ? 'Sign in to your care portal.' : 'Set up access for your care team in under a minute.'}
      </p>

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
            <label className={`hc-field ${focusedField === 'name' ? 'hc-focused' : ''}`}>
              <User size={16} />
              <input
                id="hc-name"
                type="text"
                placeholder="Dr. Jane Alabi"
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
            placeholder="you@carelink.org"
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

        <button type="submit" className="hc-submit">
          {mode === 'login' ? 'Log In to Care Portal' : 'Create Account'}
        </button>
      </form>

      <div className="hc-divider"><span>OR CONTINUE WITH</span></div>
      <div className="hc-social-row">
        <button type="button" className="hc-social-btn"><Chrome size={15} /> Google</button>
        <button type="button" className="hc-social-btn"><Facebook size={15} /> Facebook</button>
      </div>

      <p className="hc-switch-note">
        {mode === 'login' ? "New to CareLink?" : 'Already have an account?'}
        <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </div>
  );
}

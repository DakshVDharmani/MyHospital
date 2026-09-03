import { useEffect, useState } from 'react';
import { Eye, EyeOff, HeartPulse, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAdminSession, loginAdmin } from '../../lib/admin';
import './admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminSession().then(() => navigate('/admin', { replace: true })).catch(() => undefined);
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await loginAdmin(username.trim(), password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-story">
        <a className="admin-brand" href="/" aria-label="MyHospital home">
          <span><HeartPulse size={22} /></span> MyHospital
        </a>
        <div className="admin-story-copy">
          <div className="admin-kicker"><ShieldCheck size={15} /> Restricted access</div>
          <h1>Hospital intelligence,<br />in one secure view.</h1>
          <p>Monitor the Power BI reports that help your team make clearer, faster operational decisions.</p>
        </div>
        <div className="admin-story-foot"><LockKeyhole size={15} /> Authorized administrators only</div>
      </section>

      <section className="admin-login-panel">
        <form className="admin-login-card" onSubmit={submit}>
          <div className="admin-card-icon"><LockKeyhole size={23} /></div>
          <p className="admin-overline">Administration portal</p>
          <h2>Welcome back</h2>
          <p className="admin-card-sub">Enter your administrator credentials to continue.</p>

          <label htmlFor="admin-name">Admin name</label>
          <div className="admin-input"><UserRound size={17} /><input id="admin-name" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="Administrator name" required autoFocus /></div>

          <label htmlFor="admin-password">Password</label>
          <div className="admin-input"><LockKeyhole size={17} /><input id="admin-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>

          {error && <div className="admin-error" role="alert">{error}</div>}
          <button className="admin-login-button" type="submit" disabled={submitting}>{submitting ? 'Verifying…' : 'Access dashboard'}</button>
          <p className="admin-privacy"><ShieldCheck size={13} /> Session protected with an HTTP-only cookie</p>
        </form>
      </section>
    </main>
  );
}

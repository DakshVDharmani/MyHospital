import { useEffect, useState } from 'react';
import { BarChart3, ExternalLink, HeartPulse, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getAdminSession, logoutAdmin, type AdminSession } from '../../lib/admin';
import AnalyticsWorkspace from './AnalyticsWorkspace';
import './admin.css';

const powerBiUrl = (import.meta.env.VITE_POWER_BI_EMBED_URL as string | undefined)?.trim();

type Tab = 'live' | 'powerbi';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const [tab, setTab] = useState<Tab>('live');

  useEffect(() => {
    getAdminSession().then(setSession).catch(() => setSession(null)).finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="admin-checking"><span className="admin-spinner" />Checking secure session…</div>;
  if (!session) return <Navigate to="/admin/login" replace />;

  async function signOut() {
    await logoutAdmin().catch(() => undefined);
    navigate('/admin/login', { replace: true });
  }

  return (
    <main className="admin-dashboard">
      <header className="admin-topbar">
        <a className="admin-dash-brand" href="/"><span><HeartPulse size={20} /></span><div>MyHospital<small>Administration</small></div></a>
        <div className="admin-user"><span className="admin-secure"><ShieldCheck size={14} /> Secure session</span><div className="admin-avatar">MA</div><div><strong>{session.username}</strong><small>System administrator</small></div><button onClick={signOut} title="Sign out"><LogOut size={18} /></button></div>
      </header>

      <div className="admin-tabrow">
        <div className="hx-tabs">
          <button className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}>Live analytics</button>
          <button className={tab === 'powerbi' ? 'on' : ''} onClick={() => setTab('powerbi')}>Power BI report</button>
        </div>
      </div>

      {tab === 'live' ? (
        <div className="hx">
          <AnalyticsWorkspace />
        </div>
      ) : (
        <section className="admin-content">
          <div className="admin-heading">
            <div><p>Analytics workspace</p><h1>Hospital overview</h1><span>Published organizational reporting powered by Microsoft Power BI.</span></div>
            <div className="admin-heading-actions"><button onClick={() => setFrameKey((key) => key + 1)} disabled={!powerBiUrl}><RefreshCw size={15} /> Refresh report</button>{powerBiUrl && <a href={powerBiUrl} target="_blank" rel="noreferrer">Open in Power BI <ExternalLink size={14} /></a>}</div>
          </div>

          <div className="admin-report-card">
            <div className="admin-report-head"><div className="admin-report-icon"><BarChart3 size={19} /></div><div><strong>Executive analytics</strong><span>Power BI report</span></div><i><span /> Connected</i></div>
            {powerBiUrl ? (
              <iframe key={frameKey} className="admin-powerbi-frame" title="MyHospital Power BI analytics" src={powerBiUrl} allowFullScreen />
            ) : (
              <div className="admin-report-empty"><div><BarChart3 size={30} /></div><h2>Optional: attach a published Power BI report</h2><p>The live analytics tab already runs entirely on the clinical database. To embed a curated Power BI report alongside it, publish from Power BI Desktop and add its secure embed URL to the frontend environment.</p><code>VITE_POWER_BI_EMBED_URL=https://app.powerbi.com/reportEmbed?reportId=...</code><small>Restart the frontend after changing the environment file.</small></div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

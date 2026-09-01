import { useMemo, useState } from 'react';
import { Search, Users, HeartPulse, AlertOctagon, CheckCircle2, ChevronRight, MessageSquare, FileText, Activity } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useProfile } from '../../lib/useProfile';
import { PRIORITY_META, type PriorityLevel } from '../../lib/priority';
import { useDoctorPanel, useDoctorPanelRealtime, type PanelPatient } from '../../lib/panel';
import { doctorNav } from './nav';
import '../../components/dashboard.css';

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All patients' },
  { key: 'critical', label: 'Needs attention' },
  { key: 'stable', label: 'Stable' },
];

const HIGH_RISK = 60;

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function apptLabel(iso: string | null, mode: PanelPatient['nextApptMode']): string {
  if (!iso) return 'Not scheduled';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const day = sameDay
    ? 'Today'
    : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}${mode === 'video' ? ' · Video' : ''}`;
}

function lastVisitLabel(date: string | null): string {
  if (!date) return 'No prior visit';
  const d = new Date(date + 'T00:00:00');
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export default function DoctorManagingPatients() {
  const { name, loading } = useProfile();
  const panel = useDoctorPanel();
  useDoctorPanelRealtime();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  const patients = useMemo(() => panel.data ?? [], [panel.data]);

  const rows = useMemo(() => {
    return patients.filter((p) => {
      const matchQ =
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.condition.toLowerCase().includes(query.toLowerCase());
      const matchT =
        tab === 'all'
          ? true
          : tab === 'critical'
            ? p.status === 'critical' || p.status === 'urgent'
            : p.status === 'stable' || p.status === 'moderate';
      return matchQ && matchT;
    });
  }, [patients, tab, query]);

  const counts = {
    total: patients.length,
    attention: patients.filter((p) => p.status === 'critical' || p.status === 'urgent').length,
    highRisk: patients.filter((p) => p.priorityScore >= HIGH_RISK).length,
    stable: patients.filter((p) => p.status === 'stable').length,
  };

  return (
    <DashboardLayout
      roleLabel="Doctor"
      name={loading ? '…' : `Dr. ${name}`}
      eyebrow="Clinician Portal"
      pageTitle="Managing Patients"
      navItems={doctorNav('Managing Patients')}
    >
      <div className="dc-page-intro">
      </div>

      {panel.isError && (
        <div className="dc-empty" style={{ marginBottom: 18 }}>
          Couldn’t load your patient panel. Check that you’re signed in as a doctor.
        </div>
      )}

      <div className="dc-stat-row dc-section">
        <div className="dc-stat-tile">
          <div className="dc-stat-top"><span className="dc-stat-label">Panel size</span><span className="dc-stat-icon" style={{ background: 'rgba(44,127,242,0.12)', color: '#2C7FF2' }}><Users size={15} /></span></div>
          <span className="dc-stat-value">{counts.total}</span>
        </div>
        <div className="dc-stat-tile">
          <div className="dc-stat-top"><span className="dc-stat-label">Needs attention</span><span className="dc-stat-icon" style={{ background: PRIORITY_META.critical.bg, color: PRIORITY_META.critical.color }}><AlertOctagon size={15} /></span></div>
          <span className="dc-stat-value" style={{ color: PRIORITY_META.critical.color }}>{counts.attention}</span>
        </div>
        <div className="dc-stat-tile">
          <div className="dc-stat-top"><span className="dc-stat-label">High risk score</span><span className="dc-stat-icon" style={{ background: 'rgba(250,178,25,0.18)', color: '#b8860b' }}><Activity size={15} /></span></div>
          <span className="dc-stat-value">{counts.highRisk}</span>
        </div>
        <div className="dc-stat-tile">
          <div className="dc-stat-top"><span className="dc-stat-label">Stable</span><span className="dc-stat-icon" style={{ background: 'rgba(12,163,12,0.12)', color: '#0ca30c' }}><CheckCircle2 size={15} /></span></div>
          <span className="dc-stat-value">{counts.stable}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="dc-tabs" style={{ marginBottom: 0 }}>
          {TABS.map((t) => (
            <button key={t.key} className={`dc-tab ${tab === t.key ? 'dc-tab-on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="dash-search" style={{ display: 'flex', marginLeft: 'auto' }}>
          <Search size={13} />
          <input placeholder="Search name or condition…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="dc-table-wrap dc-section">
        <table className="dc-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Presenting concern</th>
              <th>Priority</th>
              <th>Risk score</th>
              <th>Next appointment</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const meta = PRIORITY_META[p.status];
              return (
                <tr key={p.patientId}>
                  <td>
                    <div className="dc-table-name">
                      <span className="dc-table-av">{p.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0B2B3C' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#5C7680', fontWeight: 600 }}>
                          {p.age != null ? `${p.age} yrs · ` : ''}last visit {lastVisitLabel(p.lastVisit)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {p.condition}
                    <div style={{ fontSize: 11, color: '#8AA0A8', fontWeight: 600 }}>triaged {relTime(p.priorityUpdatedAt)}</div>
                  </td>
                  <td><span className="dc-badge" style={{ color: meta.color, background: meta.bg }}>{meta.icon(11)} {meta.label}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60 }} className="dc-xai-bar">
                        <div className="dc-xai-bar-fill" style={{ width: `${p.priorityScore}%`, background: p.priorityScore >= HIGH_RISK ? 'linear-gradient(90deg,#ec835a,#d03b3b)' : 'linear-gradient(90deg,#0E9C8F,#34C7B5)' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#5C7680' }}>{p.priorityScore}</span>
                    </div>
                  </td>
                  <td>{apptLabel(p.nextAppt, p.nextApptMode)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="dc-icon-action" aria-label="Message" style={{ marginRight: 6 }}><MessageSquare size={14} /></button>
                    <button className="dc-icon-action" aria-label="Open chart"><FileText size={14} /></button>
                  </td>
                </tr>
              );
            })}
            {panel.isLoading && (
              <tr><td colSpan={6}><div className="dc-empty">Loading your panel…</div></td></tr>
            )}
            {!panel.isLoading && rows.length === 0 && (
              <tr><td colSpan={6}><div className="dc-empty">{patients.length === 0 ? 'No patients routed to you yet. As triage assessments come in, patients are shifted here by priority.' : 'No patients match your filters.'}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="dc-section">
        <div className="dc-quick-actions">
          <button type="button" className="dc-quick-action">
            <div className="dc-quick-action-icon"><Users size={18} /></div>
            <div><div className="dc-quick-action-label">Add a patient to panel</div><div className="dc-quick-action-sub">Assign from the intake queue</div></div>
          </button>
          <button type="button" className="dc-quick-action">
            <div className="dc-quick-action-icon"><HeartPulse size={18} /></div>
            <div><div className="dc-quick-action-label">Review flagged vitals</div><div className="dc-quick-action-sub">{counts.attention} patients need a look</div></div>
          </button>
          <button type="button" className="dc-quick-action">
            <div className="dc-quick-action-icon"><ChevronRight size={18} /></div>
            <div><div className="dc-quick-action-label">Export panel report</div><div className="dc-quick-action-sub">CSV for the care coordinator</div></div>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

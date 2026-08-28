import { useMemo, useState } from 'react';
import { Search, Users, HeartPulse, AlertOctagon, CheckCircle2, ChevronRight, MessageSquare, FileText } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useProfile } from '../../lib/useProfile';
import { PRIORITY_META, type PriorityLevel } from '../../lib/priority';
import { doctorNav } from './nav';
import '../../components/dashboard.css';

interface Patient {
  id: string;
  name: string;
  age: number;
  condition: string;
  status: PriorityLevel;
  lastVisit: string;
  adherence: number;
  nextAppt: string;
}

const PATIENTS: Patient[] = [
  { id: 'p1', name: 'Ravi Kumar', age: 54, condition: 'Coronary artery disease', status: 'critical', lastVisit: 'Today', adherence: 72, nextAppt: 'Today · 11:00 AM' },
  { id: 'p2', name: 'Fatima Sheikh', age: 33, condition: 'Viral fever, dehydration', status: 'urgent', lastVisit: '2 days ago', adherence: 88, nextAppt: 'Tomorrow · 9:30 AM' },
  { id: 'p3', name: 'Leo Martins', age: 41, condition: 'Post-op wound care', status: 'moderate', lastVisit: '5 days ago', adherence: 95, nextAppt: 'Fri · 2:00 PM' },
  { id: 'p4', name: 'Grace Chen', age: 29, condition: 'Chronic bronchitis', status: 'moderate', lastVisit: '1 week ago', adherence: 64, nextAppt: 'Mon · 10:00 AM' },
  { id: 'p5', name: 'Aditi Verma', age: 27, condition: 'Prenatal care — 24 wks', status: 'stable', lastVisit: '2 weeks ago', adherence: 99, nextAppt: 'Wed · 4:30 PM' },
  { id: 'p6', name: 'Tom Baker', age: 68, condition: 'Hypertension, T2 diabetes', status: 'stable', lastVisit: '3 weeks ago', adherence: 81, nextAppt: 'Not scheduled' },
];

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All patients' },
  { key: 'critical', label: 'Needs attention' },
  { key: 'stable', label: 'Stable' },
];

export default function DoctorManagingPatients() {
  const { name, loading } = useProfile();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return PATIENTS.filter((p) => {
      const matchQ = p.name.toLowerCase().includes(query.toLowerCase()) || p.condition.toLowerCase().includes(query.toLowerCase());
      const matchT =
        tab === 'all' ? true : tab === 'critical' ? p.status === 'critical' || p.status === 'urgent' : p.status === 'stable' || p.status === 'moderate';
      return matchQ && matchT;
    });
  }, [tab, query]);

  const counts = {
    total: PATIENTS.length,
    attention: PATIENTS.filter((p) => p.status === 'critical' || p.status === 'urgent').length,
    lowAdherence: PATIENTS.filter((p) => p.adherence < 75).length,
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
        <h1>Managing patients</h1>
        <p>Your active panel at a glance — clinical status, medication adherence and the next scheduled touchpoint for each person under your care.</p>
      </div>

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
          <div className="dc-stat-top"><span className="dc-stat-label">Low adherence</span><span className="dc-stat-icon" style={{ background: 'rgba(250,178,25,0.18)', color: '#b8860b' }}><HeartPulse size={15} /></span></div>
          <span className="dc-stat-value">{counts.lowAdherence}</span>
        </div>
        <div className="dc-stat-tile">
          <div className="dc-stat-top"><span className="dc-stat-label">Stable</span><span className="dc-stat-icon" style={{ background: 'rgba(12,163,12,0.12)', color: '#0ca30c' }}><CheckCircle2 size={15} /></span></div>
          <span className="dc-stat-value">{PATIENTS.filter((p) => p.status === 'stable').length}</span>
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
              <th>Condition</th>
              <th>Status</th>
              <th>Adherence</th>
              <th>Next appointment</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const meta = PRIORITY_META[p.status];
              return (
                <tr key={p.id}>
                  <td>
                    <div className="dc-table-name">
                      <span className="dc-table-av">{p.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0B2B3C' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#5C7680', fontWeight: 600 }}>{p.age} yrs · last visit {p.lastVisit}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.condition}</td>
                  <td><span className="dc-badge" style={{ color: meta.color, background: meta.bg }}>{meta.icon(11)} {meta.label}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60 }} className="dc-xai-bar">
                        <div className="dc-xai-bar-fill" style={{ width: `${p.adherence}%`, background: p.adherence < 75 ? 'linear-gradient(90deg,#ec835a,#d03b3b)' : 'linear-gradient(90deg,#0E9C8F,#34C7B5)' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#5C7680' }}>{p.adherence}%</span>
                    </div>
                  </td>
                  <td>{p.nextAppt}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="dc-icon-action" aria-label="Message" style={{ marginRight: 6 }}><MessageSquare size={14} /></button>
                    <button className="dc-icon-action" aria-label="Open chart"><FileText size={14} /></button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6}><div className="dc-empty">No patients match your filters.</div></td></tr>
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

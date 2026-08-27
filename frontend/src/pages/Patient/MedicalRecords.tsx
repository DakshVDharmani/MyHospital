import { useMemo, useState } from 'react';
import {
  FileText,
  FlaskConical,
  Syringe,
  Pill,
  Stethoscope,
  Download,
  Search,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';
import '../../components/dashboard.css';

type Category = 'All' | 'Lab' | 'Imaging' | 'Prescription' | 'Visit' | 'Immunization';

interface MedRecord {
  id: string;
  title: string;
  category: Exclude<Category, 'All'>;
  provider: string;
  date: string;
  tag?: string;
  tagCls?: string;
}

const RECORDS: MedRecord[] = [
  { id: 'r1', title: 'Complete Blood Count (CBC)', category: 'Lab', provider: 'HealthForGood Lab', date: '24 Aug 2026', tag: 'Normal', tagCls: 'dc-pill' },
  { id: 'r2', title: 'Lipid Panel', category: 'Lab', provider: 'HealthForGood Lab', date: '24 Aug 2026', tag: 'Review', tagCls: 'dc-pill dc-pill-amber' },
  { id: 'r3', title: 'Chest X-Ray', category: 'Imaging', provider: 'City Diagnostics', date: '12 Aug 2026', tag: 'Clear', tagCls: 'dc-pill' },
  { id: 'r4', title: 'Metformin 500mg — 90 days', category: 'Prescription', provider: 'Dr. Anjali Rao', date: '02 Aug 2026', tag: 'Active', tagCls: 'dc-pill dc-pill-blue' },
  { id: 'r5', title: 'General check-up summary', category: 'Visit', provider: 'Dr. Anjali Rao', date: '02 Aug 2026' },
  { id: 'r6', title: 'Influenza vaccine', category: 'Immunization', provider: 'HealthForGood Clinic', date: '15 Jul 2026', tag: 'Up to date', tagCls: 'dc-pill' },
  { id: 'r7', title: 'Cardiology consult notes', category: 'Visit', provider: 'Dr. Sam Okafor', date: '28 Jun 2026' },
];

const ICONS: Record<string, typeof FileText> = {
  Lab: FlaskConical,
  Imaging: FileText,
  Prescription: Pill,
  Visit: Stethoscope,
  Immunization: Syringe,
};

const FILTERS: Category[] = ['All', 'Lab', 'Imaging', 'Prescription', 'Visit', 'Immunization'];

export default function PatientMedicalRecords() {
  const { name, loading } = useProfile();
  const [filter, setFilter] = useState<Category>('All');
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () =>
      RECORDS.filter((r) => (filter === 'All' || r.category === filter) && r.title.toLowerCase().includes(query.toLowerCase())),
    [filter, query]
  );

  return (
    <DashboardLayout
      roleLabel="Patient"
      name={loading ? '…' : name}
      eyebrow="Patient Portal"
      pageTitle="Medical Records"
      navItems={patientNav('Medical Records')}
    >
      <div className="dc-page-intro">
        <h1>Medical records</h1>
        <p>Your complete health history in one secure place — labs, imaging, prescriptions, visits and immunizations. Download anything as a PDF.</p>
      </div>

      <div className="dc-stat-row dc-section">
        {[
          { label: 'Total records', value: RECORDS.length, icon: FileText, c: '#2C7FF2', bg: 'rgba(44,127,242,0.12)' },
          { label: 'Lab results', value: RECORDS.filter((r) => r.category === 'Lab').length, icon: FlaskConical, c: '#0B7A70', bg: 'rgba(14,156,143,0.12)' },
          { label: 'Active prescriptions', value: RECORDS.filter((r) => r.category === 'Prescription').length, icon: Pill, c: '#b8860b', bg: 'rgba(250,178,25,0.18)' },
          { label: 'Needs review', value: 1, icon: Stethoscope, c: '#d03b3b', bg: 'rgba(208,59,59,0.12)' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div className="dc-stat-tile" key={s.label}>
              <div className="dc-stat-top">
                <span className="dc-stat-label">{s.label}</span>
                <span className="dc-stat-icon" style={{ background: s.bg, color: s.c }}><Icon size={15} /></span>
              </div>
              <span className="dc-stat-value">{s.value}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="dc-tabs" style={{ marginBottom: 0 }}>
          {FILTERS.map((f) => (
            <button key={f} className={`dc-tab ${filter === f ? 'dc-tab-on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div className="dash-search" style={{ display: 'flex', marginLeft: 'auto' }}>
          <Search size={13} />
          <input placeholder="Search records…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="dc-table-wrap dc-section">
        <table className="dc-table">
          <thead>
            <tr>
              <th>Record</th>
              <th>Category</th>
              <th>Provider</th>
              <th>Date</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const Icon = ICONS[r.category] ?? FileText;
              return (
                <tr key={r.id}>
                  <td>
                    <div className="dc-table-name">
                      <span className="dc-table-av"><Icon size={14} /></span>
                      {r.title}
                    </div>
                  </td>
                  <td><span className="dc-pill dc-pill-grey">{r.category}</span></td>
                  <td>{r.provider}</td>
                  <td>{r.date}</td>
                  <td>{r.tag ? <span className={r.tagCls}>{r.tag}</span> : <span className="dc-pill dc-pill-grey">Filed</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="dc-icon-action" aria-label={`Download ${r.title}`}><Download size={14} /></button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6}><div className="dc-empty">No records match your filters.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { HeartPulse, Activity, Droplet, Thermometer, Wind, Scale } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LineChart } from '../../components/charts/LineChart';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';
import '../../components/dashboard.css';

interface Ring {
  label: string;
  value: string;
  unit: string;
  pct: number;
  range: string;
  color: string;
  icon: typeof HeartPulse;
}

const RINGS: Ring[] = [
  { label: 'Heart rate', value: '75', unit: 'bpm', pct: 0.62, range: '60–100 bpm', color: '#0E9C8F', icon: HeartPulse },
  { label: 'Blood pressure', value: '118/76', unit: 'mmHg', pct: 0.55, range: 'Normal', color: '#2C7FF2', icon: Activity },
  { label: 'SpO₂', value: '98', unit: '%', pct: 0.98, range: '95–100%', color: '#0ca30c', icon: Wind },
  { label: 'Glucose', value: '104', unit: 'mg/dL', pct: 0.68, range: '70–140 mg/dL', color: '#b8860b', icon: Droplet },
];

const HEART_RATE = [
  { label: 'Mon', value: 74 }, { label: 'Tue', value: 78 }, { label: 'Wed', value: 71 },
  { label: 'Thu', value: 80 }, { label: 'Fri', value: 76 }, { label: 'Sat', value: 73 }, { label: 'Sun', value: 75 },
];
const WEIGHT = [
  { label: 'Wk 1', value: 71.4 }, { label: 'Wk 2', value: 71.0 }, { label: 'Wk 3', value: 70.6 },
  { label: 'Wk 4', value: 70.8 }, { label: 'Wk 5', value: 70.2 }, { label: 'Wk 6', value: 69.9 },
];

const LOG = [
  { icon: Thermometer, label: 'Temperature', value: '36.7 °C', when: 'Today, 8:10 AM', tag: 'Normal', cls: 'dc-pill' },
  { icon: Scale, label: 'Weight', value: '69.9 kg', when: 'Yesterday', tag: '−0.3 kg', cls: 'dc-pill dc-pill-blue' },
  { icon: Droplet, label: 'Fasting glucose', value: '104 mg/dL', when: '2 days ago', tag: 'In range', cls: 'dc-pill' },
  { icon: Activity, label: 'Blood pressure', value: '118 / 76 mmHg', when: '3 days ago', tag: 'Optimal', cls: 'dc-pill' },
];

function RingGauge({ ring }: { ring: Ring }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const Icon = ring.icon;
  return (
    <div className="dc-ring-card">
      <div className="dc-ring">
        <svg width="116" height="116" viewBox="0 0 116 116">
          <circle cx="58" cy="58" r={r} fill="none" stroke="#EEF4F3" strokeWidth="10" />
          <circle
            cx="58" cy="58" r={r} fill="none" stroke={ring.color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - ring.pct)}
          />
        </svg>
        <div className="dc-ring-center">
          <Icon size={15} style={{ color: ring.color, marginBottom: 4 }} />
          <span className="dc-ring-value">{ring.value}</span>
          <span className="dc-ring-unit">{ring.unit}</span>
        </div>
      </div>
      <div>
        <div className="dc-ring-label">{ring.label}</div>
        <div className="dc-ring-range">{ring.range}</div>
      </div>
    </div>
  );
}

export default function PatientVitals() {
  const { name, loading } = useProfile();
  const [scope, setScope] = useState<'7 days' | '30 days' | '6 months'>('7 days');

  return (
    <DashboardLayout
      roleLabel="Patient"
      name={loading ? '…' : name}
      eyebrow="Patient Portal"
      pageTitle="Vitals"
      navItems={patientNav('Vitals')}
    >
      <div className="dc-page-intro">
        <h1>Your vitals</h1>
        <p>A live snapshot from your connected devices and clinic visits. Anything outside a healthy range is flagged for your care team automatically.</p>
      </div>

      <div className="dc-section">
        <div className="dc-ring-grid">
          {RINGS.map((r) => <RingGauge key={r.label} ring={r} />)}
        </div>
      </div>

      <div className="dc-tabs">
        {(['7 days', '30 days', '6 months'] as const).map((s) => (
          <button key={s} className={`dc-tab ${scope === s ? 'dc-tab-on' : ''}`} onClick={() => setScope(s)}>{s}</button>
        ))}
      </div>

      <div className="dc-grid dc-grid-2 dc-section">
        <div className="dc-card">
          <div className="dc-card-title">Resting heart rate</div>
          <div className="dc-card-sub">Beats per minute · last {scope}</div>
          <LineChart data={HEART_RATE} color="#0E9C8F" unit=" bpm" />
        </div>
        <div className="dc-card">
          <div className="dc-card-title">Weight trend</div>
          <div className="dc-card-sub">Kilograms · last {scope}</div>
          <LineChart data={WEIGHT} color="#2C7FF2" unit=" kg" />
        </div>
      </div>

      <div className="dc-section">
        <div className="dc-section-head">
          <div>
            <h2 className="dc-section-title">Recent readings</h2>
            <p className="dc-section-sub">Newest first</p>
          </div>
        </div>
        <div className="dc-list">
          {LOG.map((l) => {
            const Icon = l.icon;
            return (
              <div className="dc-list-item" key={l.label + l.when}>
                <div className="dc-list-item-main">
                  <div className="dc-list-avatar"><Icon size={15} /></div>
                  <div>
                    <div className="dc-list-title">{l.label} · {l.value}</div>
                    <div className="dc-list-sub">{l.when}</div>
                  </div>
                </div>
                <span className={l.cls}>{l.tag}</span>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

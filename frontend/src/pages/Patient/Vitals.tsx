import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeartPulse, Activity, Droplet, Thermometer, Wind, Plus } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LineChart } from '../../components/charts/LineChart';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';
import { VitalsCheckIn } from '../../voice-widget/vitals/VitalsCheckIn';
import { VitalsHistory } from '../../voice-widget/vitals/VitalsHistory';
import { fetchRecentVitals, type VitalsRow } from '../../voice-widget/vitals/vitalsApi';
import '../../components/dashboard.css';

const VOICE_BACKEND_URL = import.meta.env.VITE_VOICE_BACKEND_URL as string | undefined;

interface Ring {
  label: string;
  value: string;
  unit: string;
  pct: number;
  range: string;
  color: string;
  icon: typeof HeartPulse;
}

function clampPct(v: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

// Most recent non-null value for a field, scanning rows newest-first.
function latest<T extends keyof VitalsRow>(rowsNewestFirst: VitalsRow[], field: T): VitalsRow[T] | null {
  for (const r of rowsNewestFirst) {
    if (r[field] != null) return r[field];
  }
  return null;
}

function buildRings(rowsNewestFirst: VitalsRow[]): Ring[] {
  const hr = latest(rowsNewestFirst, 'heart_rate_bpm') as number | null;
  const sys = latest(rowsNewestFirst, 'systolic_mmhg') as number | null;
  const dia = latest(rowsNewestFirst, 'diastolic_mmhg') as number | null;
  const spo2 = latest(rowsNewestFirst, 'spo2_pct') as number | null;
  const glucose = latest(rowsNewestFirst, 'glucose_mgdl') as number | null;

  return [
    {
      label: 'Heart rate',
      value: hr != null ? String(hr) : '–',
      unit: 'bpm',
      pct: hr != null ? clampPct(hr, 40, 140) : 0,
      range: '60–100 bpm',
      color: '#0E9C8F',
      icon: HeartPulse,
    },
    {
      label: 'Blood pressure',
      value: sys != null && dia != null ? `${sys}/${dia}` : '–',
      unit: 'mmHg',
      pct: sys != null ? clampPct(sys, 80, 180) : 0,
      range: 'Normal < 120/80',
      color: '#2C7FF2',
      icon: Activity,
    },
    {
      label: 'SpO₂',
      value: spo2 != null ? String(spo2) : '–',
      unit: '%',
      pct: spo2 != null ? clampPct(spo2, 80, 100) : 0,
      range: '95–100%',
      color: '#0ca30c',
      icon: Wind,
    },
    {
      label: 'Glucose',
      value: glucose != null ? String(glucose) : '–',
      unit: 'mg/dL',
      pct: glucose != null ? clampPct(glucose, 50, 250) : 0,
      range: '70–140 mg/dL',
      color: '#b8860b',
      icon: Droplet,
    },
  ];
}

function dayLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

// One point per day (last reading of that day), oldest -> newest, for the
// trend charts. Nothing to show until the patient has actually logged data.
function dailyTrend(rowsOldestFirst: VitalsRow[], field: keyof VitalsRow): { label: string; value: number }[] {
  const byDay = new Map<string, VitalsRow>();
  for (const r of rowsOldestFirst) byDay.set(r.log_date, r); // later rows overwrite -> last-of-day wins
  return Array.from(byDay.entries())
    .filter(([, r]) => r[field] != null)
    .map(([d, r]) => ({ label: dayLabel(d), value: r[field] as unknown as number }));
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${days} days ago`;
}

interface LogEntry {
  icon: typeof HeartPulse;
  label: string;
  value: string;
  when: string;
  cls: string;
}

// One entry per reading, newest first — flattened out of whichever fields
// each check-in actually captured (a check-in fills all of them, but this
// stays correct even if that changes later).
function buildLog(rowsNewestFirst: VitalsRow[]): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const r of rowsNewestFirst) {
    const when = relativeTime(r.recorded_at);
    if (r.temperature_c != null) entries.push({ icon: Thermometer, label: 'Temperature', value: `${r.temperature_c} °C`, when, cls: 'dc-pill' });
    if (r.glucose_mgdl != null) entries.push({ icon: Droplet, label: 'Blood sugar', value: `${r.glucose_mgdl} mg/dL`, when, cls: 'dc-pill' });
    if (r.systolic_mmhg != null && r.diastolic_mmhg != null)
      entries.push({ icon: Activity, label: 'Blood pressure', value: `${r.systolic_mmhg} / ${r.diastolic_mmhg} mmHg`, when, cls: 'dc-pill' });
    if (r.heart_rate_bpm != null) entries.push({ icon: HeartPulse, label: 'Heart rate', value: `${r.heart_rate_bpm} bpm`, when, cls: 'dc-pill' });
    if (r.spo2_pct != null) entries.push({ icon: Wind, label: 'Oxygen level', value: `${r.spo2_pct} %`, when, cls: 'dc-pill' });
  }
  return entries.slice(0, 12);
}

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
  const { id: patientId, name, loading } = useProfile();
  const [scope, setScope] = useState<'7 days' | '30 days' | '6 months'>('7 days');
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [rows, setRows] = useState<VitalsRow[] | null>(null);
  const [rowsError, setRowsError] = useState('');

  const refresh = useCallback(() => {
    if (!patientId) return;
    fetchRecentVitals(patientId, 15)
      .then(setRows)
      .catch((e) => setRowsError(e.message || "Couldn't load your vitals."));
  }, [patientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rowsNewestFirst = useMemo(() => [...(rows ?? [])].reverse(), [rows]);
  const rings = useMemo(() => buildRings(rowsNewestFirst), [rowsNewestFirst]);
  const heartRateTrend = useMemo(() => dailyTrend(rows ?? [], 'heart_rate_bpm'), [rows]);
  const glucoseTrend = useMemo(() => dailyTrend(rows ?? [], 'glucose_mgdl'), [rows]);
  const log = useMemo(() => buildLog(rowsNewestFirst), [rowsNewestFirst]);

  const trendCutoff = scope === '7 days' ? 7 : undefined; // 30 days / 6 months: capped by the 15-day retention anyway
  const heartRateShown = trendCutoff ? heartRateTrend.slice(-trendCutoff) : heartRateTrend;
  const glucoseShown = trendCutoff ? glucoseTrend.slice(-trendCutoff) : glucoseTrend;

  return (
    <DashboardLayout
      roleLabel="Patient"
      name={loading ? '…' : name}
      eyebrow="Patient Portal"
      pageTitle="Vitals"
      navItems={patientNav('Vitals')}
    >
      <div className="dc-page-intro" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>Your vitals</h1>
          <p>A live snapshot from your connected devices and clinic visits. Anything outside a healthy range is flagged for your care team automatically.</p>
        </div>
        <button
          className="dc-btn dc-btn-primary"
          disabled={!patientId || !VOICE_BACKEND_URL}
          onClick={() => setCheckInOpen(true)}
          title={!patientId ? 'Sign in to log vitals' : !VOICE_BACKEND_URL ? 'Voice backend not configured' : undefined}
          style={{ flexShrink: 0 }}
        >
          <Plus size={14} /> ADD VITALS
        </button>
      </div>

      {patientId && VOICE_BACKEND_URL && checkInOpen && (
        <VitalsCheckIn
          backendUrl={VOICE_BACKEND_URL}
          patientId={patientId}
          lang="en"
          onClose={() => {
            setCheckInOpen(false);
            refresh(); // pick up whatever was just saved
          }}
          onViewHistory={() => {
            setCheckInOpen(false);
            refresh();
            setHistoryOpen(true);
          }}
        />
      )}
      {patientId && historyOpen && <VitalsHistory patientId={patientId} onClose={() => setHistoryOpen(false)} />}

      {rowsError && <div className="dc-page-intro"><p style={{ color: '#E5544A' }}>{rowsError}</p></div>}

      <div className="dc-section">
        <div className="dc-ring-grid">
          {rings.map((r) => <RingGauge key={r.label} ring={r} />)}
        </div>
      </div>

      <div className="dc-tabs">
        {(['7 days', '30 days', '6 months'] as const).map((s) => (
          <button key={s} className={`dc-tab ${scope === s ? 'dc-tab-on' : ''}`} onClick={() => setScope(s)}>{s}</button>
        ))}
      </div>

      <div className="dc-grid dc-grid-2 dc-section">
        <div className="dc-card">
          <div className="dc-card-title">Heart rate</div>
          <div className="dc-card-sub">Beats per minute · last {scope}</div>
          {heartRateShown.length > 0 ? (
            <LineChart data={heartRateShown} color="#0E9C8F" unit=" bpm" />
          ) : (
            <p className="dc-section-sub" style={{ padding: '24px 0' }}>No heart rate logged yet — tap "Add vitals" above.</p>
          )}
        </div>
        <div className="dc-card">
          <div className="dc-card-title">Blood sugar</div>
          <div className="dc-card-sub">mg/dL · last {scope}</div>
          {glucoseShown.length > 0 ? (
            <LineChart data={glucoseShown} color="#b8860b" unit=" mg/dL" />
          ) : (
            <p className="dc-section-sub" style={{ padding: '24px 0' }}>No blood sugar logged yet — tap "Add vitals" above.</p>
          )}
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
          {log.length === 0 && <p className="dc-section-sub">No readings yet — your check-ins will show up here.</p>}
          {log.map((l, i) => {
            const Icon = l.icon;
            return (
              <div className="dc-list-item" key={`${l.label}-${l.when}-${i}`}>
                <div className="dc-list-item-main">
                  <div className="dc-list-avatar"><Icon size={15} /></div>
                  <div>
                    <div className="dc-list-title">{l.label} · {l.value}</div>
                    <div className="dc-list-sub">{l.when}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useMemo } from 'react';
import {
  Clock3,
  Activity,
  AlertOctagon,
  Timer,
  Inbox,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LineChart } from '../../components/charts/LineChart';
import { BarChart } from '../../components/charts/BarChart';
import { useProfile } from '../../lib/useProfile';
import { displayDoctorName, firstNameOf } from '../../lib/formatName';
import { PRIORITY_META, PRIORITY_ORDER, type PriorityLevel } from '../../lib/priority';
import { doctorNav } from './nav';
import '../../components/dashboard.css';

interface QueuePatient {
  name: string;
  condition: string;
  waitMinutes: number;
  priority: PriorityLevel;
}

const QUEUE: QueuePatient[] = [
  { name: 'Ravi Kumar', condition: 'Chest pain, shortness of breath', waitMinutes: 6, priority: 'critical' },
  { name: 'Fatima Sheikh', condition: 'High fever, dehydration', waitMinutes: 14, priority: 'urgent' },
  { name: 'Leo Martins', condition: 'Post-op wound check', waitMinutes: 22, priority: 'moderate' },
  { name: 'Grace Chen', condition: 'Persistent cough, 3 days', waitMinutes: 28, priority: 'moderate' },
  { name: 'Aditi Verma', condition: 'Routine prenatal check-up', waitMinutes: 35, priority: 'stable' },
  { name: 'Tom Baker', condition: 'Prescription refill', waitMinutes: 41, priority: 'stable' },
];

const PATIENTS_PER_DAY = [
  { label: 'Mon', value: 18 },
  { label: 'Tue', value: 22 },
  { label: 'Wed', value: 19 },
  { label: 'Thu', value: 25 },
  { label: 'Fri', value: 21 },
  { label: 'Sat', value: 14 },
  { label: 'Sun', value: 9 },
];

const MESSAGES = [
  { from: 'Ravi Kumar', preview: 'The pain has gotten worse since this morning.', when: '4m ago' },
  { from: 'Care Coordinator', preview: 'Lab results ready for Fatima Sheikh.', when: '20m ago' },
];

export default function DoctorHome() {
  const { name, loading } = useProfile();
  const firstName = loading ? '' : firstNameOf(name);

  const sortedQueue = useMemo(
    () => [...QUEUE].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)),
    []
  );

  const priorityCounts = useMemo(() => {
    const counts: Record<PriorityLevel, number> = { critical: 0, urgent: 0, moderate: 0, stable: 0 };
    for (const p of QUEUE) counts[p.priority]++;
    return counts;
  }, []);

  const criticalCount = priorityCounts.critical;
  const avgWait = Math.round(QUEUE.reduce((s, p) => s + p.waitMinutes, 0) / QUEUE.length);

  return (
    <DashboardLayout roleLabel="Doctor" name={loading ? '…' : displayDoctorName(name)} eyebrow="Clinician Portal" pageTitle="Home" navItems={doctorNav('Home')}>
      <section className="dc-hero">
        <div className="dc-hero-inner">
          <div className="dc-hero-eyebrow"><span className="dc-hero-eyebrow-dot" /> HealthForGood clinician view</div>
          <h1 className="dc-hero-title">
            {loading ? <span className="dc-skeleton" style={{ width: 300, height: 27, display: 'inline-block' }} /> : `Welcome back, Dr. ${firstName || 'there'}.`}
          </h1>
          <p className="dc-hero-sub">Here's today's patient load, sorted by who needs you first — scroll down to see the full queue.</p>
          <div className="dc-hero-chips">
            <div className="dc-hero-chip"><span className="dc-hero-chip-icon"><AlertOctagon size={12} /></span> {criticalCount} critical case{criticalCount === 1 ? '' : 's'}</div>
            <div className="dc-hero-chip"><span className="dc-hero-chip-icon"><Timer size={12} /></span> {avgWait}m avg. wait</div>
            <div className="dc-hero-chip"><span className="dc-hero-chip-icon"><Activity size={12} /></span> {QUEUE.length} patients today</div>
          </div>
        </div>
      </section>

      <div className="dc-section">
        <div className="dc-stat-row">
          <div className="dc-stat-tile">
            <div className="dc-stat-top">
              <span className="dc-stat-label">Patients today</span>
              <span className="dc-stat-icon" style={{ background: 'rgba(44, 127, 242, 0.12)', color: '#2C7FF2' }}><Activity size={15} /></span>
            </div>
            <span className="dc-stat-value">{QUEUE.length}</span>
          </div>
          <div className="dc-stat-tile">
            <div className="dc-stat-top">
              <span className="dc-stat-label">Critical cases</span>
              <span className="dc-stat-icon" style={{ background: PRIORITY_META.critical.bg, color: PRIORITY_META.critical.color }}><AlertOctagon size={15} /></span>
            </div>
            <span className="dc-stat-value" style={{ color: criticalCount > 0 ? PRIORITY_META.critical.color : undefined }}>{criticalCount}</span>
          </div>
          <div className="dc-stat-tile">
            <div className="dc-stat-top">
              <span className="dc-stat-label">Avg. wait time</span>
              <span className="dc-stat-icon" style={{ background: 'rgba(14, 156, 143, 0.12)', color: '#0B7A70' }}><Clock3 size={15} /></span>
            </div>
            <span className="dc-stat-value">{avgWait}m</span>
          </div>
          <div className="dc-stat-tile">
            <div className="dc-stat-top">
              <span className="dc-stat-label">Unread messages</span>
              <span className="dc-stat-icon" style={{ background: 'rgba(11, 43, 60, 0.08)', color: '#0B2B3C' }}><Inbox size={15} /></span>
            </div>
            <span className="dc-stat-value">{MESSAGES.length}</span>
          </div>
        </div>
      </div>

      <div className="dc-section">
        <div className="dc-section-head">
          <div>
            <h2 className="dc-section-title">Who to treat first</h2>
            <p className="dc-section-sub">Sorted by clinical priority, most urgent first</p>
          </div>
        </div>
        <div>
          {sortedQueue.map((p) => {
            const meta = PRIORITY_META[p.priority];
            return (
              <div className="dc-queue-row" key={p.name}>
                <div className="dc-queue-main">
                  <span className="dc-badge" style={{ color: meta.color, background: meta.bg }}>
                    {meta.icon(12)} {meta.label}
                  </span>
                  <div>
                    <div className="dc-queue-name">{p.name}</div>
                    <div className="dc-queue-condition">{p.condition}</div>
                  </div>
                </div>
                <div className="dc-queue-wait">
                  <Clock3 size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                  waiting {p.waitMinutes}m
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dc-grid dc-grid-2 dc-section">
        <div className="dc-card">
          <div className="dc-card-title">Patients by priority</div>
          <div className="dc-card-sub">Today's queue, by clinical urgency</div>
          <BarChart
            data={PRIORITY_ORDER.map((level) => ({
              label: PRIORITY_META[level].label,
              value: priorityCounts[level],
              color: PRIORITY_META[level].color,
            }))}
          />
        </div>

        <div className="dc-card">
          <div className="dc-card-title">Patients treated this week</div>
          <div className="dc-card-sub">Total consultations per day</div>
          <LineChart data={PATIENTS_PER_DAY} color="#2C7FF2" />
        </div>
      </div>

      <div className="dc-section">
        <div className="dc-section-head">
          <div>
            <h2 className="dc-section-title">Recent messages</h2>
            <p className="dc-section-sub">From patients and your care team</p>
          </div>
        </div>
        <div className="dc-list">
          {MESSAGES.map((m) => (
            <div className="dc-list-item" key={m.from + m.when}>
              <div className="dc-list-item-main">
                <div className="dc-list-avatar">{m.from.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>
                <div>
                  <div className="dc-list-title">{m.from}</div>
                  <div className="dc-list-sub">{m.preview}</div>
                </div>
              </div>
              <div className="dc-list-meta">{m.when}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

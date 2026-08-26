import { useEffect, useMemo, useState } from 'react';
import {
  Home,
  MessageSquare,
  CalendarDays,
  Users,
  ClipboardList,
  Clock3,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LineChart } from '../../components/charts/LineChart';
import { BarChart } from '../../components/charts/BarChart';
import { supabase } from '../../lib/supabaseClient';
import { PRIORITY_META, PRIORITY_ORDER, type PriorityLevel } from '../../lib/priority';
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
  const [name, setName] = useState('Doctor');

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const meta = data.user?.user_metadata as { name?: string } | undefined;
      if (meta?.name) setName(meta.name.split(' ')[0]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const navItems = [
    { label: 'Home', icon: <Home size={16} />, active: true },
    { label: 'Patient queue', icon: <ClipboardList size={16} /> },
    { label: 'Messages', icon: <MessageSquare size={16} /> },
    { label: 'Schedule', icon: <CalendarDays size={16} /> },
    { label: 'My patients', icon: <Users size={16} /> },
  ];

  return (
    <DashboardLayout roleLabel="Doctor" name={`Dr. ${name}`} navItems={navItems}>
      <div className="dc-hero">
        <h1 className="dc-hero-title">Welcome back, Dr. {name}.</h1>
        <p className="dc-hero-sub">Here's today's patient load, sorted by who needs you first.</p>
      </div>

      <div className="dc-section">
        <div className="dc-stat-row">
          <div className="dc-stat-tile">
            <span className="dc-stat-label">Patients today</span>
            <span className="dc-stat-value">{QUEUE.length}</span>
          </div>
          <div className="dc-stat-tile">
            <span className="dc-stat-label">Critical cases</span>
            <span className="dc-stat-value" style={{ color: criticalCount > 0 ? PRIORITY_META.critical.color : undefined }}>
              {criticalCount}
            </span>
          </div>
          <div className="dc-stat-tile">
            <span className="dc-stat-label">Avg. wait time</span>
            <span className="dc-stat-value">{Math.round(QUEUE.reduce((s, p) => s + p.waitMinutes, 0) / QUEUE.length)}m</span>
          </div>
          <div className="dc-stat-tile">
            <span className="dc-stat-label">Unread messages</span>
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

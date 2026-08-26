import { useEffect, useState } from 'react';
import {
  Home,
  MessageSquare,
  CalendarDays,
  FileText,
  FolderClock,
  CalendarPlus,
  Pill,
  HeartPulse,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LineChart } from '../../components/charts/LineChart';
import { supabase } from '../../lib/supabaseClient';
import '../../components/dashboard.css';

const HEART_RATE: { label: string; value: number }[] = [
  { label: 'Mon', value: 74 },
  { label: 'Tue', value: 78 },
  { label: 'Wed', value: 71 },
  { label: 'Thu', value: 80 },
  { label: 'Fri', value: 76 },
  { label: 'Sat', value: 73 },
  { label: 'Sun', value: 75 },
];

const APPOINTMENTS = [
  { doctor: 'Dr. Anjali Rao', specialty: 'General Physician', when: 'Tomorrow · 10:30 AM' },
  { doctor: 'Dr. Sam Okafor', specialty: 'Cardiology follow-up', when: 'Fri, 24 Sep · 4:00 PM' },
];

const MESSAGES = [
  { from: 'Dr. Anjali Rao', preview: 'Your latest reports look good — keep taking the prescribed dose.', when: '2h ago' },
  { from: 'Care Coordinator', preview: 'Reminder: fasting required before Friday’s blood test.', when: '1d ago' },
];

export default function PatientHome() {
  const [name, setName] = useState('there');

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

  const navItems = [
    { label: 'Home', icon: <Home size={16} />, active: true },
    { label: 'Messages', icon: <MessageSquare size={16} /> },
    { label: 'Appointments', icon: <CalendarDays size={16} /> },
    { label: 'Prescriptions', icon: <Pill size={16} /> },
    { label: 'Records', icon: <FolderClock size={16} /> },
  ];

  return (
    <DashboardLayout roleLabel="Patient" name={name} navItems={navItems}>
      <div className="dc-hero">
        <h1 className="dc-hero-title">Welcome back, {name}.</h1>
        <p className="dc-hero-sub">Here's what's happening with your care team today.</p>
      </div>

      <div className="dc-section">
        <div className="dc-quick-actions">
          <button type="button" className="dc-quick-action">
            <div className="dc-quick-action-icon"><MessageSquare size={18} /></div>
            <div>
              <div className="dc-quick-action-label">Message your doctor</div>
              <div className="dc-quick-action-sub">Usually replies within a few hours</div>
            </div>
          </button>
          <button type="button" className="dc-quick-action">
            <div className="dc-quick-action-icon"><CalendarPlus size={18} /></div>
            <div>
              <div className="dc-quick-action-label">Book a consultation</div>
              <div className="dc-quick-action-sub">In-person or video</div>
            </div>
          </button>
          <button type="button" className="dc-quick-action">
            <div className="dc-quick-action-icon"><FileText size={18} /></div>
            <div>
              <div className="dc-quick-action-label">View prescriptions</div>
              <div className="dc-quick-action-sub">2 active prescriptions</div>
            </div>
          </button>
        </div>
      </div>

      <div className="dc-grid dc-grid-2 dc-section">
        <div className="dc-card">
          <div className="dc-card-title">Your vitals this week</div>
          <div className="dc-card-sub">Resting heart rate, beats per minute</div>
          <LineChart data={HEART_RATE} color="#0E9C8F" unit=" bpm" />
        </div>

        <div className="dc-card">
          <div className="dc-card-title">Upcoming appointments</div>
          <div className="dc-card-sub">Your next scheduled visits</div>
          <div className="dc-list">
            {APPOINTMENTS.map((a) => (
              <div className="dc-list-item" key={a.doctor + a.when}>
                <div className="dc-list-item-main">
                  <div className="dc-list-avatar"><HeartPulse size={16} /></div>
                  <div>
                    <div className="dc-list-title">{a.doctor}</div>
                    <div className="dc-list-sub">{a.specialty}</div>
                  </div>
                </div>
                <div className="dc-list-meta">{a.when}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dc-section">
        <div className="dc-section-head">
          <div>
            <h2 className="dc-section-title">Recent messages</h2>
            <p className="dc-section-sub">From your care team</p>
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

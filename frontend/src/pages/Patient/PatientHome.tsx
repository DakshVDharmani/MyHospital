import {
  MessageSquare,
  FileText,
  CalendarPlus,
  HeartPulse,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LineChart } from '../../components/charts/LineChart';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';
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
  const { name, loading } = useProfile();
  const firstName = loading ? '' : name.split(' ')[0];

  return (
    <DashboardLayout roleLabel="Patient" name={loading ? '…' : name} eyebrow="Patient Portal" pageTitle="Home" navItems={patientNav('Home')}>
      <section className="dc-hero">
        <div className="dc-hero-inner">
          <div className="dc-hero-eyebrow"><span className="dc-hero-eyebrow-dot" /> HealthForGood care network</div>
          <h1 className="dc-hero-title">
            {loading ? <span className="dc-skeleton" style={{ width: 260, height: 27, display: 'inline-block' }} /> : `Welcome back, ${firstName}.`}
          </h1>
          <p className="dc-hero-sub">Here's what's happening with your care team today — your vitals, appointments, and messages, all in one place.</p>
          <div className="dc-hero-chips">
            <div className="dc-hero-chip"><span className="dc-hero-chip-icon"><ShieldCheck size={12} /></span> HIPAA-aware care</div>
            <div className="dc-hero-chip"><span className="dc-hero-chip-icon"><HeartPulse size={12} /></span> 2 upcoming visits</div>
            <div className="dc-hero-chip"><span className="dc-hero-chip-icon"><Sparkles size={12} /></span> Care team online</div>
          </div>
        </div>
      </section>

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

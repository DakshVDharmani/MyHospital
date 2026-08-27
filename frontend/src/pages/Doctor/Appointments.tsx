import { useState } from 'react';
import {
  Video,
  MapPin,
  Check,
  X,
  Clock3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useProfile } from '../../lib/useProfile';
import { doctorNav } from './nav';
import '../../components/dashboard.css';

const WEEK = [
  { day: 'Mon', date: 25, count: 6 },
  { day: 'Tue', date: 26, count: 8 },
  { day: 'Wed', date: 27, count: 5, today: true },
  { day: 'Thu', date: 28, count: 7 },
  { day: 'Fri', date: 29, count: 4 },
  { day: 'Sat', date: 30, count: 2 },
];

const DAY_APPTS = [
  { time: '09:00', name: 'Aditi Verma', reason: 'Prenatal check-up', mode: 'In-person', status: 'confirmed' },
  { time: '09:45', name: 'Leo Martins', reason: 'Post-op wound review', mode: 'In-person', status: 'confirmed' },
  { time: '10:30', name: 'Grace Chen', reason: 'Cough, 3 days', mode: 'Video', status: 'confirmed' },
  { time: '11:00', name: 'Ravi Kumar', reason: 'Chest pain follow-up', mode: 'In-person', status: 'priority' },
  { time: '11:30', name: 'Fatima Sheikh', reason: 'Fever review', mode: 'Video', status: 'confirmed' },
  { time: '12:30', name: 'Tom Baker', reason: 'Prescription refill', mode: 'In-person', status: 'confirmed' },
];

const REQUESTS = [
  { name: 'Nadia Osei', reason: 'New patient · persistent headaches', pref: 'Thu afternoon', mode: 'Video' },
  { name: 'Sam Rivera', reason: 'Rash with mild fever', pref: 'ASAP', mode: 'In-person' },
];

export default function DoctorAppointments() {
  const { name, loading } = useProfile();
  const [selected, setSelected] = useState(2);
  const [requests, setRequests] = useState(REQUESTS);

  return (
    <DashboardLayout
      roleLabel="Doctor"
      name={loading ? '…' : `Dr. ${name}`}
      eyebrow="Clinician Portal"
      pageTitle="Appointments"
      navItems={doctorNav('Appointments')}
    >
      <div className="dc-page-intro">
        <h1>Appointments</h1>
        <p>Your schedule for the week, today's visits in order, and the requests waiting on your approval.</p>
      </div>

      <div className="dc-card dc-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="dc-card-title" style={{ margin: 0 }}><CalendarDays size={14} style={{ verticalAlign: -2, marginRight: 6 }} />August 2026 — Week 35</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="dc-icon-action" aria-label="Previous week"><ChevronLeft size={14} /></button>
            <button className="dc-icon-action" aria-label="Next week"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {WEEK.map((w, i) => (
            <button
              key={w.day}
              className="dc-slot"
              style={{
                borderColor: i === selected ? '#0E9C8F' : undefined,
                background: i === selected ? 'rgba(14,156,143,0.08)' : w.today ? '#F2F8F7' : undefined,
              }}
              onClick={() => setSelected(i)}
            >
              <div className="dc-slot-tag">{w.day}{w.today ? ' · today' : ''}</div>
              <div className="dc-slot-time">{w.date}</div>
              <div className="dc-slot-tag">{w.count} visits</div>
            </button>
          ))}
        </div>
      </div>

      <div className="dc-grid dc-section" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div>
          <div className="dc-section-head">
            <div>
              <h2 className="dc-section-title">Wednesday, 27 Aug</h2>
              <p className="dc-section-sub">{DAY_APPTS.length} appointments · 1 priority</p>
            </div>
          </div>
          {DAY_APPTS.map((a) => (
            <div className="dc-appt-row" key={a.time}>
              <div className="dc-appt-date" style={a.status === 'priority' ? { background: 'linear-gradient(135deg,#ec835a,#d03b3b)' } : undefined}>
                <span className="dc-appt-date-day">{a.time.split(':')[0]}</span>
                <span className="dc-appt-date-mon">:{a.time.split(':')[1]}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dc-appt-name">{a.name}</div>
                <div className="dc-appt-meta">{a.reason}</div>
              </div>
              <span className={`dc-pill ${a.mode === 'Video' ? 'dc-pill-blue' : 'dc-pill-grey'}`}>
                {a.mode === 'Video' ? <Video size={11} /> : <MapPin size={11} />} {a.mode}
              </span>
              {a.status === 'priority'
                ? <span className="dc-pill dc-pill-red">Priority</span>
                : <span className="dc-pill"><Check size={11} /> Confirmed</span>}
            </div>
          ))}
        </div>

        <div>
          <div className="dc-section-head">
            <div>
              <h2 className="dc-section-title">Pending requests</h2>
              <p className="dc-section-sub">{requests.length} awaiting your response</p>
            </div>
          </div>
          {requests.map((r) => (
            <div className="dc-card" key={r.name} style={{ marginBottom: 12, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div className="dc-list-avatar">{r.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
                <div>
                  <div className="dc-appt-name">{r.name}</div>
                  <div className="dc-appt-meta">{r.reason}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className="dc-pill dc-pill-grey"><Clock3 size={11} /> {r.pref}</span>
                <span className={`dc-pill ${r.mode === 'Video' ? 'dc-pill-blue' : 'dc-pill-grey'}`}>{r.mode === 'Video' ? <Video size={11} /> : <MapPin size={11} />} {r.mode}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="dc-btn dc-btn-primary" style={{ flex: 1 }} onClick={() => setRequests((q) => q.filter((x) => x.name !== r.name))}><Check size={13} /> Accept</button>
                <button className="dc-btn dc-btn-ghost-danger" onClick={() => setRequests((q) => q.filter((x) => x.name !== r.name))}><X size={13} /> Decline</button>
              </div>
            </div>
          ))}
          {requests.length === 0 && <div className="dc-empty">All caught up — no pending requests.</div>}
        </div>
      </div>
    </DashboardLayout>
  );
}

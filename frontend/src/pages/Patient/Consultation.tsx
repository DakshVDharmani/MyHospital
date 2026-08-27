import { useState } from 'react';
import {
  Video,
  MapPin,
  Stethoscope,
  Calendar,
  Clock3,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';
import '../../components/dashboard.css';

const DOCTORS = [
  { id: 'd1', name: 'Dr. Anjali Rao', specialty: 'General Physician', next: 'Today', rating: '4.9' },
  { id: 'd2', name: 'Dr. Sam Okafor', specialty: 'Cardiology', next: 'Tomorrow', rating: '4.8' },
  { id: 'd3', name: 'Dr. Meera Nair', specialty: 'Dermatology', next: 'Wed, 3 Sep', rating: '4.7' },
];

const SLOTS = ['09:00', '09:30', '10:00', '11:30', '14:00', '15:30', '16:00', '17:30'];
const TAKEN = new Set(['10:00', '14:00']);

const UPCOMING = [
  { doctor: 'Dr. Anjali Rao', mode: 'Video', when: 'Tomorrow · 10:30 AM' },
  { doctor: 'Dr. Sam Okafor', mode: 'In-person', when: 'Fri, 24 Sep · 4:00 PM' },
];

export default function PatientConsultation() {
  const { name, loading } = useProfile();
  const [mode, setMode] = useState<'Video' | 'In-person'>('Video');
  const [doctor, setDoctor] = useState(DOCTORS[0].id);
  const [slot, setSlot] = useState<string | null>('11:30');
  const [booked, setBooked] = useState(false);

  return (
    <DashboardLayout
      roleLabel="Patient"
      name={loading ? '…' : name}
      eyebrow="Patient Portal"
      pageTitle="Consultation"
      navItems={patientNav('Consultation')}
    >
      <div className="dc-page-intro">
        <h1>Book a consultation</h1>
        <p>Choose how you'd like to meet, pick a clinician, and grab a time that works. You'll get a secure reminder before it starts.</p>
      </div>

      <div className="dc-tabs">
        {(['Video', 'In-person'] as const).map((m) => (
          <button key={m} className={`dc-tab ${mode === m ? 'dc-tab-on' : ''}`} onClick={() => setMode(m)}>
            {m === 'Video' ? <Video size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> : <MapPin size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}
            {m}
          </button>
        ))}
      </div>

      <div className="dc-grid dc-grid-2 dc-section">
        <div className="dc-card">
          <div className="dc-card-title">1 · Choose a clinician</div>
          <div className="dc-card-sub">Available for {mode.toLowerCase()} visits</div>
          <div className="dc-list">
            {DOCTORS.map((d) => (
              <button
                key={d.id}
                className="dc-list-item"
                style={{ cursor: 'pointer', border: d.id === doctor ? '1px solid #0E9C8F' : undefined, background: d.id === doctor ? '#fff' : undefined }}
                onClick={() => setDoctor(d.id)}
              >
                <div className="dc-list-item-main">
                  <div className="dc-list-avatar"><Stethoscope size={15} /></div>
                  <div>
                    <div className="dc-list-title">{d.name}</div>
                    <div className="dc-list-sub">{d.specialty} · ★ {d.rating}</div>
                  </div>
                </div>
                <div className="dc-list-meta">Next: {d.next}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="dc-card">
          <div className="dc-card-title">2 · Pick a time</div>
          <div className="dc-card-sub"><Calendar size={12} style={{ verticalAlign: -2 }} /> Thursday, 28 Aug</div>
          <div className="dc-slot-grid" style={{ marginTop: 6 }}>
            {SLOTS.map((s) => {
              const off = TAKEN.has(s);
              return (
                <button
                  key={s}
                  disabled={off}
                  className={`dc-slot ${slot === s ? 'dc-slot-on' : ''} ${off ? 'dc-slot-off' : ''}`}
                  onClick={() => setSlot(s)}
                >
                  <div className="dc-slot-time">{s}</div>
                  <div className="dc-slot-tag">{off ? 'Booked' : '30 min'}</div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="dc-btn dc-btn-primary" onClick={() => setBooked(true)} disabled={!slot}>
              {booked ? <><CheckCircle2 size={14} /> Requested</> : <>Confirm booking <ChevronRight size={14} /></>}
            </button>
            {slot && !booked && (
              <span className="dc-pill dc-pill-blue">{mode} · {DOCTORS.find((d) => d.id === doctor)?.name} · {slot}</span>
            )}
            {booked && <span className="dc-pill">We'll confirm within a few hours</span>}
          </div>
        </div>
      </div>

      <div className="dc-section">
        <div className="dc-section-head">
          <div>
            <h2 className="dc-section-title">Upcoming consultations</h2>
            <p className="dc-section-sub">Confirmed visits with your care team</p>
          </div>
        </div>
        <div className="dc-list">
          {UPCOMING.map((u) => (
            <div className="dc-list-item" key={u.doctor + u.when}>
              <div className="dc-list-item-main">
                <div className="dc-list-avatar">{u.mode === 'Video' ? <Video size={15} /> : <MapPin size={15} />}</div>
                <div>
                  <div className="dc-list-title">{u.doctor}</div>
                  <div className="dc-list-sub">{u.mode} consultation</div>
                </div>
              </div>
              <div className="dc-list-meta"><Clock3 size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{u.when}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

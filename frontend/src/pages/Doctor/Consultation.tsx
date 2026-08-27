import { useState } from 'react';
import {
  Stethoscope,
  HeartPulse,
  Wind,
  Thermometer,
  Activity,
  Plus,
  X,
  Video,
  ClipboardList,
  Send,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useProfile } from '../../lib/useProfile';
import { doctorNav } from './nav';
import '../../components/dashboard.css';

const QUEUE = [
  { name: 'Ravi Kumar', reason: 'Chest pain follow-up', time: '11:00', mode: 'In-person', active: true },
  { name: 'Fatima Sheikh', reason: 'Fever review', time: '11:30', mode: 'Video', active: false },
  { name: 'Grace Chen', reason: 'Persistent cough', time: '12:00', mode: 'Video', active: false },
  { name: 'Tom Baker', reason: 'Prescription refill', time: '12:30', mode: 'In-person', active: false },
];

const VITALS = [
  { icon: HeartPulse, label: 'Heart rate', value: '96 bpm', cls: 'dc-pill dc-pill-amber' },
  { icon: Activity, label: 'BP', value: '148/92', cls: 'dc-pill dc-pill-red' },
  { icon: Wind, label: 'SpO₂', value: '95%', cls: 'dc-pill' },
  { icon: Thermometer, label: 'Temp', value: '37.1 °C', cls: 'dc-pill' },
];

export default function DoctorConsultation() {
  const { name, loading } = useProfile();
  const [activeIdx, setActiveIdx] = useState(0);
  const [notes, setNotes] = useState('');
  const [rx, setRx] = useState<string[]>(['Aspirin 75 mg — once daily', 'Atorvastatin 20 mg — night']);
  const [newRx, setNewRx] = useState('');
  const patient = QUEUE[activeIdx];

  return (
    <DashboardLayout
      roleLabel="Doctor"
      name={loading ? '…' : `Dr. ${name}`}
      eyebrow="Clinician Portal"
      pageTitle="Consultation"
      navItems={doctorNav('Consultation')}
    >
      <div className="dc-page-intro">
        <h1>Consultation room</h1>
        <p>Everything for the visit in front of you — the patient's live vitals, your notes, and the prescription you'll send to their record when you close the encounter.</p>
      </div>

      <div className="dc-grid dc-section" style={{ gridTemplateColumns: '300px 1fr' }}>
        <div className="dc-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #DCEBE8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: '#5C7680' }}>
            <ClipboardList size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Today's list
          </div>
          {QUEUE.map((q, i) => (
            <button
              key={q.name}
              className={`dc-chat-person ${i === activeIdx ? 'dc-chat-on' : ''}`}
              onClick={() => setActiveIdx(i)}
            >
              <span className="dc-chat-person-av">{q.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
              <div style={{ minWidth: 0 }}>
                <div className="dc-chat-person-name">{q.name}</div>
                <div className="dc-chat-person-last">{q.reason}</div>
              </div>
              <div className="dc-chat-person-meta">
                <span className="dc-chat-person-time">{q.time}</span>
                <span className="dc-pill dc-pill-grey" style={{ padding: '2px 7px' }}>{q.mode === 'Video' ? <Video size={10} /> : <Stethoscope size={10} />}</span>
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="dc-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="dc-list-avatar" style={{ width: 46, height: 46 }}>{patient.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Fraunces','Manrope',serif", fontWeight: 600, fontSize: 16, color: '#0B2B3C' }}>{patient.name}</div>
                <div style={{ fontSize: 11.5, color: '#5C7680', fontWeight: 600 }}>{patient.reason} · {patient.time} · {patient.mode}</div>
              </div>
              <button className="dc-btn dc-btn-primary">{patient.mode === 'Video' ? <><Video size={13} /> Join call</> : <>Start visit</>}</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              {VITALS.map((v) => {
                const Icon = v.icon;
                return (
                  <span key={v.label} className={v.cls}>
                    <Icon size={11} /> {v.label} {v.value}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="dc-card">
            <div className="dc-card-title">Consultation notes</div>
            <div className="dc-card-sub">Saved to the encounter — visible to the patient's care team</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Presenting complaint, examination findings, assessment, plan…"
              style={{
                width: '100%', minHeight: 130, resize: 'vertical', borderRadius: 12,
                border: '1.5px solid #DCEBE8', padding: 12, fontFamily: 'inherit', fontSize: 12.5,
                fontWeight: 500, color: '#10262E', outline: 'none', lineHeight: 1.6,
              }}
            />
          </div>

          <div className="dc-card">
            <div className="dc-card-title">Prescription</div>
            <div className="dc-card-sub">Sent to the patient's pharmacy on visit close</div>
            <div className="dc-list" style={{ marginBottom: 12 }}>
              {rx.map((m, i) => (
                <div className="dc-list-item" key={m}>
                  <div className="dc-list-item-main">
                    <div className="dc-list-avatar">Rx</div>
                    <div className="dc-list-title">{m}</div>
                  </div>
                  <button className="dc-icon-action" aria-label="Remove" onClick={() => setRx((r) => r.filter((_, x) => x !== i))}><X size={13} /></button>
                </div>
              ))}
              {rx.length === 0 && <div className="dc-empty">No medications added yet.</div>}
            </div>
            <div className="dc-chat-compose" style={{ padding: 0, border: 'none' }}>
              <input
                placeholder="e.g. Metformin 500 mg — twice daily with food"
                value={newRx}
                onChange={(e) => setNewRx(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newRx.trim()) { setRx((r) => [...r, newRx.trim()]); setNewRx(''); } }}
              />
              <button className="dc-chat-send" aria-label="Add medication" onClick={() => { if (newRx.trim()) { setRx((r) => [...r, newRx.trim()]); setNewRx(''); } }}><Plus size={16} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="dc-btn">Save draft</button>
            <button className="dc-btn dc-btn-primary"><Send size={13} /> Close & send summary</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

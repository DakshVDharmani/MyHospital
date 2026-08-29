import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Video,
  MapPin,
  CalendarPlus,
  Ban,
  Clock3,
  CalendarHeart,
  CalendarClock,
  ArrowRight,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { AppointmentsCalendar } from '../../components/AppointmentsCalendar';
import { useProfile } from '../../lib/useProfile';
import { listDoctors } from '../../lib/chat';
import {
  useAppointments,
  useRequestAppointment,
  useCancelAppointment,
  type Appointment,
  type ApptMode,
} from '../../lib/appointments';
import { patientNav } from './nav';
import '../../components/dashboard.css';
import '../../components/appointments.css';

const STATUS_PILL: Record<Appointment['status'], string> = {
  requested: 'ax-pill-amber',
  confirmed: 'ax-pill-teal',
  completed: 'ax-pill-blue',
  declined: 'ax-pill-red',
  cancelled: 'ax-pill-grey',
};

const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function whenLabel(a: { start: string }) {
  const s = new Date(a.start);
  const day = s.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${hhmm(s)}`;
}

export default function PatientAppointments() {
  const { id, name, loading } = useProfile();
  const appts = useAppointments();
  const requestMut = useRequestAppointment();
  const cancelMut = useCancelAppointment();
  const doctors = useQuery({ queryKey: ['doctors'], queryFn: listDoctors, staleTime: 5 * 60_000 });

  const [form, setForm] = useState({
    doctorId: '',
    title: '',
    reason: '',
    mode: 'in_person' as ApptMode,
    date: '',
    time: '',
    window: '',
  });

  const rows = appts.data ?? [];
  const now = new Date();
  const upcoming = useMemo(
    () => rows.filter((a) => a.status === 'confirmed' && new Date(a.start) >= now).length,
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const awaiting = useMemo(() => rows.filter((a) => a.status === 'requested').length, [rows]);
  const nextUp = useMemo(
    () =>
      rows
        .filter((a) => a.status === 'confirmed' && new Date(a.start) >= now)
        .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0],
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const submit = () => {
    if (!form.doctorId || !form.title.trim()) return;
    const doctorName = doctors.data?.find((d) => d.id === form.doctorId)?.name ?? '';
    const start =
      form.date && form.time ? new Date(`${form.date}T${form.time}`).toISOString() : undefined;
    requestMut.mutate(
      {
        doctorId: form.doctorId,
        doctorName,
        title: form.title.trim(),
        reason: form.reason.trim(),
        mode: form.mode,
        start,
        preferredWindow: form.window.trim() || (start ? '' : 'Flexible'),
      },
      {
        onSuccess: () =>
          setForm({ doctorId: '', title: '', reason: '', mode: 'in_person', date: '', time: '', window: '' }),
      },
    );
  };

  return (
    <DashboardLayout
      roleLabel="Patient"
      name={loading ? '…' : name}
      eyebrow="Patient Portal"
      pageTitle="Appointments"
      navItems={patientNav('Appointments')}
    >
      {appts.isError && (
        <div className="ax-error">Couldn’t reach the appointments service. Please try again shortly.</div>
      )}

      {/* ---------------- Hero ---------------- */}
      <div className="ax-hero">
        <div className="ax-hero-inner">
          <div className="ax-hero-eyebrow">
            <span className="ax-hero-eyebrow-dot" /> Your care schedule
          </div>
          <h1 className="ax-hero-title">Book time with your care team</h1>
          <p className="ax-hero-sub">
            Pick a time that suits you and send a request — your doctor confirms the final slot.
          </p>
          <div className="ax-hero-stats">
            <div className="ax-stat">
              <span className="ax-stat-ic"><CalendarHeart size={14} /></span>
              <div><div className="ax-stat-v">{upcoming}</div><div className="ax-stat-k">Upcoming visits</div></div>
            </div>
            <div className="ax-stat">
              <span className="ax-stat-ic"><CalendarClock size={14} /></span>
              <div><div className="ax-stat-v">{awaiting}</div><div className="ax-stat-k">Awaiting confirmation</div></div>
            </div>
            <div className="ax-stat">
              <span className="ax-stat-ic"><ArrowRight size={14} /></span>
              <div>
                <div className="ax-stat-v">{nextUp ? hhmm(new Date(nextUp.start)) : '—'}</div>
                <div className="ax-stat-k">{nextUp ? `Next · ${nextUp.doctorName || 'your doctor'}` : 'Nothing booked yet'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ax-layout">
        <AppointmentsCalendar appointments={rows} myId={id ?? ''} />

        <div className="ax-rail">
          {/* ---------- Request an appointment ---------- */}
          <div className="ax-panel ax-composer">
            <div className="ax-panel-top">
              <span className="ax-panel-ic"><CalendarPlus size={16} /></span>
              <div>
                <h3 className="ax-panel-head">Request an appointment</h3>
                <p className="ax-panel-sub">Your doctor confirms the final time.</p>
              </div>
            </div>

            <label className="ax-field">
              <span className="ax-label">Doctor</span>
              <select
                className="ax-select"
                value={form.doctorId}
                onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
              >
                <option value="">Select a doctor…</option>
                {(doctors.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>

            <label className="ax-field">
              <span className="ax-label">Reason</span>
              <input
                className="ax-input"
                placeholder="e.g. Persistent headache, 4 days"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>

            <div className="ax-row-2">
              <label className="ax-field">
                <span className="ax-label">Preferred date</span>
                <input
                  type="date"
                  className="ax-input"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </label>
              <label className="ax-field">
                <span className="ax-label">Preferred time</span>
                <input
                  type="time"
                  className="ax-input"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                />
              </label>
            </div>

            <label className="ax-field">
              <span className="ax-label">Or describe a window</span>
              <input
                className="ax-input"
                placeholder="e.g. Any weekday afternoon"
                value={form.window}
                onChange={(e) => setForm((f) => ({ ...f, window: e.target.value }))}
              />
            </label>

            <div className="ax-field">
              <span className="ax-label">Mode</span>
              <div className="ax-seg">
                <button className={form.mode === 'in_person' ? 'ax-on' : ''} onClick={() => setForm((f) => ({ ...f, mode: 'in_person' }))}>
                  <MapPin size={12} /> In-person
                </button>
                <button className={form.mode === 'video' ? 'ax-on' : ''} onClick={() => setForm((f) => ({ ...f, mode: 'video' }))}>
                  <Video size={12} /> Video
                </button>
              </div>
            </div>

            <label className="ax-field">
              <span className="ax-label">Anything else</span>
              <textarea
                className="ax-textarea"
                placeholder="Optional details for your doctor…"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>

            {requestMut.isError && <div className="ax-error">{(requestMut.error as Error).message}</div>}

            <button
              className="ax-btn ax-btn-primary ax-btn-block"
              disabled={requestMut.isPending || !form.doctorId || !form.title.trim()}
              onClick={submit}
            >
              <CalendarPlus size={14} /> {requestMut.isPending ? 'Sending…' : 'Send request'}
            </button>
          </div>

          {/* ---------- Your appointments ---------- */}
          <div className="ax-panel">
            <div className="ax-panel-top">
              <span className="ax-panel-ic"><CalendarHeart size={16} /></span>
              <div>
                <h3 className="ax-panel-head">Your appointments</h3>
                <p className="ax-panel-sub">{rows.length} total</p>
              </div>
            </div>

            {rows.map((a) => (
              <div className={`ax-reqcard is-${a.status}`} key={a.id}>
                <div className="ax-reqcard-top">
                  <span className="ax-avatar">
                    {(a.doctorName || 'Dr')
                      .replace(/^Dr\.?\s*/i, '')
                      .split(/\s+/)
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="ax-reqcard-name">{a.doctorName || 'Your doctor'}</div>
                    <div className="ax-reqcard-meta">{a.title}</div>
                  </div>
                </div>
                <div className="ax-reqcard-chips">
                  <span className={`ax-pill ${STATUS_PILL[a.status]}`}><span className="ax-dot" />{a.status}</span>
                  <span className="ax-pill ax-pill-grey">
                    {a.status === 'requested' && a.preferredWindow ? (
                      <><Clock3 size={11} /> {a.preferredWindow}</>
                    ) : (
                      whenLabel(a)
                    )}
                  </span>
                  <span className={`ax-pill ${a.mode === 'video' ? 'ax-pill-blue' : 'ax-pill-grey'}`}>
                    {a.mode === 'video' ? <Video size={11} /> : <MapPin size={11} />} {a.mode === 'video' ? 'Video' : 'In-person'}
                  </span>
                </div>
                {a.status === 'requested' && (
                  <button
                    className="ax-btn ax-btn-danger ax-btn-block"
                    disabled={cancelMut.isPending}
                    onClick={() => cancelMut.mutate(a.id)}
                  >
                    <Ban size={13} /> Cancel request
                  </button>
                )}
              </div>
            ))}

            {rows.length === 0 && (
              <div className="ax-empty">
                <span className="ax-empty-ic"><CalendarHeart size={20} /></span>
                <p>No appointments yet</p>
                <span>Send a request above and it’ll appear here.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

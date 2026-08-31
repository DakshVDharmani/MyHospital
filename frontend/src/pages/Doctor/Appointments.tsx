import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Video,
  MapPin,
  Check,
  X,
  Clock3,
  CheckCheck,
  Ban,
  CalendarPlus,
  CalendarCheck,
  Inbox,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { AppointmentsCalendar } from '../../components/AppointmentsCalendar';
import { useProfile } from '../../lib/useProfile';
import { listPatients } from '../../lib/chat';
import {
  useAppointments,
  useAppointmentsRealtime,
  useCreateAppointment,
  useUpdateAppointment,
  type Appointment,
  type ApptMode,
} from '../../lib/appointments';
import { doctorNav } from './nav';
import '../../components/dashboard.css';
import '../../components/appointments.css';

const DURATIONS = [15, 30, 45, 60];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function whenLabel(a: { start: string; end: string }) {
  const s = new Date(a.start);
  const e = new Date(a.end);
  const day = s.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${hhmm(s)}–${hhmm(e)}`;
}

export default function DoctorAppointments() {
  const { id, name, loading } = useProfile();
  const navigate = useNavigate();
  const appts = useAppointments();
  useAppointmentsRealtime();
  const createMut = useCreateAppointment();
  const updateMut = useUpdateAppointment();
  const patients = useQuery({ queryKey: ['patients'], queryFn: listPatients, staleTime: 5 * 60_000 });

  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [form, setForm] = useState({
    patientId: '',
    title: '',
    reason: '',
    mode: 'in_person' as ApptMode,
    minutes: 30,
  });

  const rows = appts.data ?? [];
  const now = new Date();
  const pending = useMemo(() => rows.filter((a) => a.status === 'requested'), [rows]);
  const confirmedToday = useMemo(
    () => rows.filter((a) => a.status === 'confirmed' && sameDay(new Date(a.start), now)).length,
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const nextUp = useMemo(
    () =>
      rows
        .filter((a) => a.status === 'confirmed' && new Date(a.start) >= now)
        .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0],
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const openSlot = (start: string, end: string) => {
    setSelected(null);
    setSlot({ start, end });
    setForm((f) => ({
      ...f,
      minutes: Math.max(15, Math.round((+new Date(end) - +new Date(start)) / 60000)) || 30,
    }));
  };

  const submitNew = () => {
    if (!form.patientId || !form.title.trim() || !slot) return;
    const start = new Date(slot.start);
    const end = new Date(start.getTime() + form.minutes * 60000);
    createMut.mutate(
      {
        patientId: form.patientId,
        title: form.title.trim(),
        reason: form.reason.trim(),
        mode: form.mode,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      {
        onSuccess: () => {
          setSlot(null);
          setForm({ patientId: '', title: '', reason: '', mode: 'in_person', minutes: 30 });
        },
      },
    );
  };

  const patch = (
    aid: string,
    body: Partial<Pick<Appointment, 'title' | 'reason' | 'mode' | 'location' | 'notes' | 'status' | 'start' | 'end'>>,
  ) => updateMut.mutate({ id: aid, ...body });

  const todayLabel = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <DashboardLayout
      roleLabel="Doctor"
      name={loading ? '…' : `Dr. ${name}`}
      eyebrow="Clinician Portal"
      pageTitle="Appointments"
      navItems={doctorNav('Appointments')}
    >
      {appts.isError && (
        <div className="ax-error">
          Couldn’t reach the appointments service. Is the API running and <code>VITE_API_URL</code> set?
        </div>
      )}

      {/* ---------------- Hero ---------------- */}
      <div className="ax-hero">
        <div className="ax-hero-inner">
          <div className="ax-hero-eyebrow">
            <span className="ax-hero-eyebrow-dot" /> {todayLabel}
          </div>
          <h1 className="ax-hero-title">Your schedule, at a glance</h1>
          <p className="ax-hero-sub">
            Drag to reschedule, click a free slot to book, and approve patient requests from the panel on the right.
          </p>
          <div className="ax-hero-stats">
            <div className="ax-stat">
              <span className="ax-stat-ic"><CalendarCheck size={14} /></span>
              <div><div className="ax-stat-v">{confirmedToday}</div><div className="ax-stat-k">Confirmed today</div></div>
            </div>
            <div className="ax-stat">
              <span className="ax-stat-ic"><Inbox size={14} /></span>
              <div><div className="ax-stat-v">{pending.length}</div><div className="ax-stat-k">Awaiting approval</div></div>
            </div>
            <div className="ax-stat">
              <span className="ax-stat-ic"><ArrowRight size={14} /></span>
              <div>
                <div className="ax-stat-v">{nextUp ? hhmm(new Date(nextUp.start)) : '—'}</div>
                <div className="ax-stat-k">{nextUp ? `Next · ${nextUp.patientName}` : 'Nothing upcoming'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ax-layout">
        <AppointmentsCalendar
          appointments={rows}
          myId={id ?? ''}
          editable
          onSelectSlot={openSlot}
          onSelectEvent={(a) => {
            setSlot(null);
            setSelected(a);
          }}
          onReschedule={(aid, start, end) => updateMut.mutate({ id: aid, start, end })}
        />

        <div className="ax-rail">
          {/* ---------- Video visits ---------- */}
          {rows.some((a) => a.status === 'confirmed' && a.mode === 'video') && (
            <div className="ax-panel">
              <div className="ax-panel-top">
                <span className="ax-panel-ic"><Video size={16} /></span>
                <div>
                  <h3 className="ax-panel-head">Video visits</h3>
                  <p className="ax-panel-sub">Open the room — the patient joins the same link</p>
                </div>
              </div>
              {rows
                .filter((a) => a.status === 'confirmed' && a.mode === 'video')
                .sort((a, b) => +new Date(a.start) - +new Date(b.start))
                .map((a) => (
                  <div className="ax-reqcard is-confirmed" key={a.id}>
                    <div className="ax-reqcard-top">
                      <span className="ax-avatar">
                        {a.patientName.split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="ax-reqcard-name">{a.patientName}</div>
                        <div className="ax-reqcard-meta">{a.title}</div>
                      </div>
                    </div>
                    <button
                      className="ax-btn ax-btn-primary ax-btn-block"
                      onClick={() => navigate(`/doctor/call/${a.id}`)}
                    >
                      <Video size={13} /> Join video call
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* ---------- New appointment ---------- */}
          {slot && (
            <div className="ax-panel ax-composer">
              <div className="ax-panel-top">
                <span className="ax-panel-ic"><CalendarPlus size={16} /></span>
                <div>
                  <h3 className="ax-panel-head">New appointment</h3>
                  <p className="ax-panel-sub">
                    {whenLabel({
                      start: slot.start,
                      end: new Date(+new Date(slot.start) + form.minutes * 60000).toISOString(),
                    })}
                  </p>
                </div>
              </div>

              <label className="ax-field">
                <span className="ax-label">Patient</span>
                <select
                  className="ax-select"
                  value={form.patientId}
                  onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                >
                  <option value="">Select a patient…</option>
                  {(patients.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label className="ax-field">
                <span className="ax-label">Reason</span>
                <input
                  className="ax-input"
                  placeholder="e.g. Follow-up · chest pain"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>

              <div className="ax-row-2">
                <label className="ax-field">
                  <span className="ax-label">Duration</span>
                  <select
                    className="ax-select"
                    value={form.minutes}
                    onChange={(e) => setForm((f) => ({ ...f, minutes: Number(e.target.value) }))}
                  >
                    {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                  </select>
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
              </div>

              <label className="ax-field">
                <span className="ax-label">Notes for the visit</span>
                <textarea
                  className="ax-textarea"
                  placeholder="Optional context…"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </label>

              <div className="ax-btn-row">
                <button
                  className="ax-btn ax-btn-primary ax-btn-block"
                  disabled={createMut.isPending || !form.patientId || !form.title.trim()}
                  onClick={submitNew}
                >
                  <CalendarPlus size={14} /> {createMut.isPending ? 'Scheduling…' : 'Schedule'}
                </button>
                <button className="ax-btn ax-btn-ghost" onClick={() => setSlot(null)}>Cancel</button>
              </div>
            </div>
          )}

          {/* ---------- Manage selected ---------- */}
          {selected && !slot && (
            <div className="ax-panel">
              <div className="ax-panel-top">
                <span className="ax-panel-ic"><Sparkles size={16} /></span>
                <div>
                  <h3 className="ax-panel-head">Manage appointment</h3>
                  <p className="ax-panel-sub">{selected.patientName}</p>
                </div>
              </div>

              <p className="ax-manage-title">{selected.title}</p>
              <p className="ax-manage-when">{whenLabel(selected)}</p>

              <div className="ax-reqcard-chips">
                <span className={`ax-pill ${
                  selected.status === 'confirmed' ? 'ax-pill-teal'
                  : selected.status === 'requested' ? 'ax-pill-amber'
                  : selected.status === 'completed' ? 'ax-pill-blue'
                  : 'ax-pill-grey'
                }`}><span className="ax-dot" />{selected.status}</span>
                <span className="ax-pill ax-pill-grey">{selected.mode === 'video' ? 'Video' : 'In-person'}</span>
              </div>

              {selected.status === 'confirmed' && selected.mode === 'video' && (
                <button
                  className="ax-btn ax-btn-primary ax-btn-block"
                  onClick={() => navigate(`/doctor/call/${selected.id}`)}
                >
                  <Video size={13} /> Join video call
                </button>
              )}

              <div className="ax-field">
                <span className="ax-label">Mode</span>
                <div className="ax-seg">
                  <button className={selected.mode === 'in_person' ? 'ax-on' : ''} onClick={() => patch(selected.id, { mode: 'in_person' })}>
                    <MapPin size={12} /> In-person
                  </button>
                  <button className={selected.mode === 'video' ? 'ax-on' : ''} onClick={() => patch(selected.id, { mode: 'video' })}>
                    <Video size={12} /> Video
                  </button>
                </div>
              </div>

              <label className="ax-field">
                <span className="ax-label">Private note</span>
                <textarea
                  className="ax-textarea"
                  defaultValue={selected.notes}
                  onBlur={(e) => e.target.value !== selected.notes && patch(selected.id, { notes: e.target.value })}
                  placeholder="Only you can see this"
                />
              </label>

              <div className="ax-btn-row" style={{ flexWrap: 'wrap' }}>
                {selected.status === 'requested' && (
                  <>
                    <button className="ax-btn ax-btn-primary" onClick={() => patch(selected.id, { status: 'confirmed' })}>
                      <Check size={14} /> Confirm
                    </button>
                    <button className="ax-btn ax-btn-danger" onClick={() => patch(selected.id, { status: 'declined' })}>
                      <X size={14} /> Decline
                    </button>
                  </>
                )}
                {selected.status === 'confirmed' && (
                  <button className="ax-btn ax-btn-ghost" onClick={() => patch(selected.id, { status: 'completed' })}>
                    <CheckCheck size={14} /> Mark complete
                  </button>
                )}
                {(selected.status === 'requested' || selected.status === 'confirmed') && (
                  <button className="ax-btn ax-btn-danger" onClick={() => patch(selected.id, { status: 'cancelled' })}>
                    <Ban size={14} /> Cancel
                  </button>
                )}
                <button className="ax-btn ax-btn-ghost" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          )}

          {/* ---------- Pending requests ---------- */}
          <div className="ax-panel">
            <div className="ax-panel-top">
              <span className="ax-panel-ic ax-amber"><Inbox size={16} /></span>
              <div>
                <h3 className="ax-panel-head">Pending requests</h3>
                <p className="ax-panel-sub">{pending.length} awaiting your response</p>
              </div>
            </div>

            {pending.map((r) => (
              <div className="ax-reqcard is-requested" key={r.id}>
                <div className="ax-reqcard-top">
                  <span className="ax-avatar">
                    {r.patientName.split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="ax-reqcard-name">{r.patientName}</div>
                    <div className="ax-reqcard-meta">{r.title}</div>
                  </div>
                </div>
                <div className="ax-reqcard-chips">
                  {r.preferredWindow && (
                    <span className="ax-pill ax-pill-grey"><Clock3 size={11} /> {r.preferredWindow}</span>
                  )}
                  <span className={`ax-pill ${r.mode === 'video' ? 'ax-pill-blue' : 'ax-pill-grey'}`}>
                    {r.mode === 'video' ? <Video size={11} /> : <MapPin size={11} />} {r.mode === 'video' ? 'Video' : 'In-person'}
                  </span>
                </div>
                <div className="ax-btn-row">
                  <button className="ax-btn ax-btn-primary" style={{ flex: 1 }} onClick={() => updateMut.mutate({ id: r.id, status: 'confirmed' })}>
                    <Check size={13} /> Confirm
                  </button>
                  <button className="ax-btn ax-btn-danger" onClick={() => updateMut.mutate({ id: r.id, status: 'declined' })}>
                    <X size={13} /> Decline
                  </button>
                </div>
              </div>
            ))}

            {pending.length === 0 && (
              <div className="ax-empty">
                <span className="ax-empty-ic"><CalendarCheck size={20} /></span>
                <p>You’re all caught up</p>
                <span>New requests from patients show up here.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

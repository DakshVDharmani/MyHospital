import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  MapPin,
  CalendarPlus,
  Ban,
  Clock3,
  CalendarHeart,
  CalendarClock,
  ArrowRight,
  Sparkles,
  Stethoscope,
  Gauge,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { AppointmentsCalendar } from '../../components/AppointmentsCalendar';
import { useProfile } from '../../lib/useProfile';
import { listDoctors } from '../../lib/chat';
import { findBestDoctor, type RankedDoctor } from '../../lib/triage';
import {
  useAppointments,
  useAppointmentsRealtime,
  useRequestAppointment,
  useCancelAppointment,
  APPT_TYPE_LABEL,
  type Appointment,
  type ApptMode,
  type ApptType,
} from '../../lib/appointments';
import { patientNav } from './nav';
import '../../components/dashboard.css';
import '../../components/appointments.css';

type RouteState = 'idle' | 'loading' | 'done' | 'error';

const loadTier = (ratio: number): { label: string; cls: string } =>
  ratio < 0.5
    ? { label: 'Light load', cls: 'ax-pill-teal' }
    : ratio < 0.85
      ? { label: 'Moderate load', cls: 'ax-pill-amber' }
      : { label: 'Busy', cls: 'ax-pill-red' };

const STATUS_PILL: Record<Appointment['status'], string> = {
  requested: 'ax-pill-amber',
  confirmed: 'ax-pill-teal',
  completed: 'ax-pill-blue',
  declined: 'ax-pill-red',
  cancelled: 'ax-pill-grey',
  no_show: 'ax-pill-red',
};

const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function whenLabel(a: { start: string }) {
  const s = new Date(a.start);
  const day = s.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${hhmm(s)}`;
}

export default function PatientAppointments() {
  const { id, name, latitude, longitude, loading } = useProfile();
  const navigate = useNavigate();
  const appts = useAppointments();
  useAppointmentsRealtime();
  const requestMut = useRequestAppointment();
  const cancelMut = useCancelAppointment();

  const [form, setForm] = useState({
    title: '',
    reason: '',
    type: 'general_consultation' as ApptType,
    mode: 'in_person' as ApptMode,
    date: '',
    time: '',
    window: '',
  });

  // ---- Auto-routing: the patient never picks a doctor by name. What they
  // type in "Reason" is classified by the triage model, matched against
  // doctors of the right specialty/urgency, then ranked by distance + how
  // light their current load is. -----------------------------------------
  const [routeState, setRouteState] = useState<RouteState>('idle');
  const [routed, setRouted] = useState<RankedDoctor | null>(null);
  const [routeMeta, setRouteMeta] = useState<{ specialty: string; fallback: boolean } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const routeSeq = useRef(0);

  const runRouting = useMemo(
    () => async (complaint: string) => {
      const seq = ++routeSeq.current;
      setRouteState('loading');
      setRouteError(null);
      try {
        const result = await findBestDoctor(complaint, {
          patientId: id,
          patientLat: latitude,
          patientLng: longitude,
          source: 'self_report',
        });
        if (seq !== routeSeq.current) return;
        if (result.best) {
          setRouted(result.best);
          setRouteMeta({ specialty: result.specialty, fallback: false });
          setRouteState('done');
          return;
        }
        // No specialty match from triage — fall back to any doctor so the
        // patient is never stuck unable to book.
        const all = await listDoctors();
        if (seq !== routeSeq.current) return;
        if (all.length === 0) throw new Error('No doctors are available to route to right now.');
        const pick = all[Math.floor(Math.random() * all.length)];
        setRouted({
          user_id: pick.id,
          doctor_code: '',
          full_name: pick.name,
          specialty: 'General',
          years_experience: 0,
          rating: 0,
          city: null,
          consultation_fee: null,
          current_load: 0,
          weekly_capacity: 0,
          distanceKm: null,
          loadRatio: 0,
        });
        setRouteMeta({ specialty: result.specialty, fallback: true });
        setRouteState('done');
      } catch (e) {
        if (seq !== routeSeq.current) return;
        setRouteError((e as Error).message || 'Could not reach the routing service.');
        setRouteState('error');
      }
    },
    [id, latitude, longitude],
  );

  // Debounce: re-route ~900ms after the patient stops typing their reason.
  useEffect(() => {
    const complaint = form.title.trim();
    if (complaint.length < 6) {
      routeSeq.current++;
      setRouteState('idle');
      setRouted(null);
      setRouteMeta(null);
      setRouteError(null);
      return;
    }
    const t = setTimeout(() => void runRouting(complaint), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title]);

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
    if (!routed || !form.title.trim()) return;
    const start =
      form.date && form.time ? new Date(`${form.date}T${form.time}`).toISOString() : undefined;
    requestMut.mutate(
      {
        doctorId: routed.user_id,
        title: form.title.trim(),
        reason: form.reason.trim(),
        appointmentType: form.type,
        mode: form.mode,
        start,
        preferredWindow: form.window.trim() || (start ? '' : 'Flexible'),
      },
      {
        onSuccess: () => {
          setForm({
            title: '',
            reason: '',
            type: 'general_consultation',
            mode: 'in_person',
            date: '',
            time: '',
            window: '',
          });
          routeSeq.current++;
          setRouteState('idle');
          setRouted(null);
          setRouteMeta(null);
        },
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
              <span className="ax-label">Reason</span>
              <input
                className="ax-input"
                placeholder="e.g. Persistent headache, 4 days"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>

            {/* ---- Auto-routed doctor: no manual picker. The reason above
                 drives the triage model, which matches the nearest, least
                 busy doctor for the right specialty. ---- */}
            <div className="ax-field">
              <span className="ax-label">Doctor</span>
              {routeState === 'idle' && (
                <div className="ax-route-hint">
                  <Sparkles size={13} /> Describe the reason above and we’ll match you with a doctor automatically.
                </div>
              )}
              {routeState === 'loading' && (
                <div className="ax-route-hint">
                  <Loader2 size={13} className="ax-spin-ic" /> Finding the right doctor for you…
                </div>
              )}
              {routeState === 'error' && (
                <div className="ax-route-hint ax-route-hint-err">
                  {routeError || 'Could not route automatically.'}
                  <button type="button" className="ax-route-retry" onClick={() => void runRouting(form.title.trim())}>
                    <RefreshCw size={11} /> Retry
                  </button>
                </div>
              )}
              {routeState === 'done' && routed && (
                <div className="ax-route-card">
                  <span className="ax-avatar">
                    {routed.full_name
                      .replace(/^Dr\.?\s*/i, '')
                      .split(/\s+/)
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div className="ax-route-body">
                    <div className="ax-route-name">Dr. {routed.full_name.replace(/^Dr\.?\s*/i, '')}</div>
                    <div className="ax-route-chips">
                      <span className="ax-pill ax-pill-blue"><Stethoscope size={10} /> {routeMeta?.specialty ?? routed.specialty}</span>
                      {routed.distanceKm != null && (
                        <span className="ax-pill ax-pill-grey"><MapPin size={10} /> {routed.distanceKm < 1 ? '<1' : routed.distanceKm.toFixed(1)} km away</span>
                      )}
                      {!routeMeta?.fallback && (
                        <span className={`ax-pill ${loadTier(routed.loadRatio).cls}`}>
                          <Gauge size={10} /> {loadTier(routed.loadRatio).label}
                        </span>
                      )}
                    </div>
                    <p className="ax-route-note">
                      {routeMeta?.fallback
                        ? 'No specialty match yet — matched you with an available doctor.'
                        : 'Matched by AI triage on distance and current patient load.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ax-route-retry ax-route-retry-corner"
                    title="Route again"
                    onClick={() => void runRouting(form.title.trim())}
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
              )}
            </div>

            <label className="ax-field">
              <span className="ax-label">Appointment type</span>
              <select
                className="ax-select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ApptType }))}
              >
                {(Object.keys(APPT_TYPE_LABEL) as ApptType[]).map((t) => (
                  <option key={t} value={t}>
                    {APPT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
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
              disabled={requestMut.isPending || !routed || routeState === 'loading' || !form.title.trim()}
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
                {a.status === 'confirmed' && a.mode === 'video' && (
                  <button
                    className="ax-btn ax-btn-primary ax-btn-block"
                    onClick={() => navigate(`/patient/call/${a.id}`)}
                  >
                    <Video size={13} /> Join video call
                  </button>
                )}
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

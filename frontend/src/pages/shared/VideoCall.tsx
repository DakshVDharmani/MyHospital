import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useProfile } from '../../lib/useProfile';
import {
  fetchAppointment,
  markMeetingEnded,
  markMeetingStarted,
  APPT_TYPE_LABEL,
  type Appointment,
} from '../../lib/appointments';
import { useWebRtcRoom } from '../../lib/webrtc';

const STATUS_TEXT: Record<string, string> = {
  idle: 'Ready',
  requesting_media: 'Enabling camera…',
  waiting: 'Waiting for the other person to join…',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'The other person left the call',
  failed: 'Connection problem',
};

function Stream({ stream, muted, mirror }: { stream: MediaStream | null; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: mirror ? 'scaleX(-1)' : undefined,
        background: '#0b1620',
      }}
    />
  );
}

export default function VideoCall() {
  const { appointmentId = '' } = useParams();
  const navigate = useNavigate();
  const { id: myId, role, loading: profileLoading } = useProfile();

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAppointment(appointmentId)
      .then((a) => {
        if (cancelled) return;
        if (!a) setNotFound(true);
        else setAppt(a);
      })
      .catch((e) => !cancelled && setLoadErr((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const isParty = !!appt && !!myId && (appt.doctorId === myId || appt.patientId === myId);
  const isDoctor = role === 'doctor';
  const peerName = appt ? (isDoctor ? appt.patientName : appt.doctorName) : '';

  // Use the appointment id itself as the room key — it is exactly what is in
  // the URL, so "same link" always means "same room" for both parties.
  const room = joined && appt ? appt.id : null;
  const call = useWebRtcRoom(room, joined);

  useEffect(() => {
    if (joined && appt) void markMeetingStarted(appt.id).catch(() => {});
  }, [joined, appt]);

  const leave = async (complete = false) => {
    call.hangUp();
    if (appt) await markMeetingEnded(appt.id, complete).catch(() => {});
    setJoined(false);
    navigate(isDoctor ? '/doctor/appointments' : '/patient/appointments');
  };

  const backHref = isDoctor ? '/doctor/appointments' : '/patient/appointments';
  const heading = useMemo(() => {
    if (!appt) return 'Video consultation';
    return `${APPT_TYPE_LABEL[appt.appointmentType]} · ${appt.title}`;
  }, [appt]);

  return (
    <div className="vc-root">
      <style>{`
        .vc-root { position: fixed; inset: 0; background: #071019; color: #E7F0F0;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; }
        .vc-top { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .vc-back { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12); color: #cfe0e0; border-radius: 9px; padding: 7px 11px;
          font-size: 12px; font-weight: 700; cursor: pointer; }
        .vc-back:hover { background: rgba(255,255,255,0.12); }
        .vc-title { font-weight: 700; font-size: 13.5px; }
        .vc-sub { font-size: 11px; color: #8aa; }
        .vc-pill { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700;
          padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); }
        .vc-dot { width: 7px; height: 7px; border-radius: 50%; background: #35c07a; }
        .vc-dot.warn { background: #e6b800; } .vc-dot.bad { background: #e5544a; }
        .vc-stage { flex: 1; position: relative; overflow: hidden; }
        .vc-remote { position: absolute; inset: 0; }
        .vc-local { position: absolute; right: 16px; bottom: 96px; width: 220px; max-width: 34vw; aspect-ratio: 16/9;
          border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 8px 30px rgba(0,0,0,0.45); }
        .vc-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; text-align: center; padding: 24px; }
        .vc-spin { animation: vc-spin 1s linear infinite; } @keyframes vc-spin { to { transform: rotate(360deg); } }
        .vc-bar { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
        .vc-btn { width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.08); color: #eef; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .vc-btn:hover { background: rgba(255,255,255,0.16); }
        .vc-btn.off { background: #b23b34; border-color: #b23b34; color: #fff; }
        .vc-btn.hang { background: #e5544a; border-color: #e5544a; color: #fff; width: 60px; height: 52px; border-radius: 16px; }
        .vc-cta { background: #0E9C8F; color: #fff; border: none; border-radius: 12px; padding: 12px 20px; font-weight: 800;
          font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .vc-cta.secondary { background: rgba(255,255,255,0.1); }
        .vc-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
          padding: 26px; max-width: 420px; }
        .vc-name-lg { font-size: 18px; font-weight: 800; }
        .vc-muted { color: #8aa; font-size: 12.5px; line-height: 1.5; }
      `}</style>

      <div className="vc-top">
        <button className="vc-back" onClick={() => navigate(backHref)}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <div className="vc-title">{heading}</div>
          <div className="vc-sub">{peerName ? `with ${peerName}` : 'Secure peer-to-peer video'}</div>
        </div>
        <span className="vc-pill">
          <span
            className={`vc-dot ${
              call.status === 'connected' ? '' : call.status === 'failed' ? 'bad' : 'warn'
            }`}
          />
          {STATUS_TEXT[call.status] ?? call.status}
        </span>
      </div>

      <div className="vc-stage">
        {joined && (
          <>
            <div className="vc-remote">
              <Stream stream={call.remoteStream} />
            </div>
            <div className="vc-local">
              <Stream stream={call.localStream} muted mirror />
            </div>
          </>
        )}

        {/* Pre-join / states */}
        {!joined && (
          <div className="vc-overlay">
            {profileLoading || (!appt && !notFound && !loadErr) ? (
              <>
                <Loader2 className="vc-spin" size={26} />
                <div className="vc-muted">Loading appointment…</div>
              </>
            ) : notFound ? (
              <div className="vc-card">
                <div className="vc-name-lg">Appointment not found</div>
                <p className="vc-muted">This link may be wrong, or the visit was cancelled.</p>
                <button className="vc-cta secondary" onClick={() => navigate(backHref)}>
                  Go back
                </button>
              </div>
            ) : loadErr ? (
              <div className="vc-card">
                <div className="vc-name-lg">Couldn’t load the call</div>
                <p className="vc-muted">{loadErr}</p>
              </div>
            ) : !isParty ? (
              <div className="vc-card">
                <div className="vc-name-lg">You’re not on this appointment</div>
                <p className="vc-muted">Only the patient and doctor for this visit can join.</p>
                <button className="vc-cta secondary" onClick={() => navigate(backHref)}>
                  Go back
                </button>
              </div>
            ) : appt && appt.mode !== 'video' ? (
              <div className="vc-card">
                <div className="vc-name-lg">This is an in-person visit</div>
                <p className="vc-muted">
                  Switch the appointment to “Video” to use the online room.
                </p>
                <button className="vc-cta secondary" onClick={() => navigate(backHref)}>
                  Go back
                </button>
              </div>
            ) : (
              <div className="vc-card" style={{ textAlign: 'center' }}>
                <ShieldCheck size={26} style={{ color: '#35c07a' }} />
                <div className="vc-name-lg" style={{ marginTop: 8 }}>
                  {peerName || 'Your visit'}
                </div>
                <p className="vc-muted">
                  {appt?.status === 'confirmed'
                    ? 'The room is private to you and the other party. Your camera and mic stay on your device — the media never touches a server.'
                    : `This appointment is “${appt?.status}”. You can still open the room, but the visit isn’t confirmed yet.`}
                </p>
                <button className="vc-cta" onClick={() => setJoined(true)} style={{ marginTop: 6 }}>
                  <VideoIcon size={15} /> Join video room
                </button>
              </div>
            )}
          </div>
        )}

        {joined && call.status === 'failed' && (
          <div className="vc-overlay" style={{ background: 'rgba(7,16,25,0.82)' }}>
            <div className="vc-card">
              <div className="vc-name-lg">Connection problem</div>
              <p className="vc-muted">{call.error ?? 'The video connection dropped.'}</p>
              <button className="vc-cta" onClick={call.retry}>
                <RefreshCw size={14} /> Try again
              </button>
            </div>
          </div>
        )}

        {joined && (call.status === 'waiting' || call.status === 'connecting') && !call.peerPresent && (
          <div className="vc-overlay" style={{ pointerEvents: 'none' }}>
            <Loader2 className="vc-spin" size={24} />
            <div className="vc-muted">{STATUS_TEXT[call.status]}</div>
            <div className="vc-muted" style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
              room {appt?.id.slice(0, 8)} · you are the {isDoctor ? 'doctor' : 'patient'} · share this
              exact link with the other party
            </div>
          </div>
        )}
      </div>

      {joined && (
        <div className="vc-bar">
          <button
            className={`vc-btn ${call.micOn ? '' : 'off'}`}
            onClick={call.toggleMic}
            aria-label={call.micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {call.micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            className={`vc-btn ${call.camOn ? '' : 'off'}`}
            onClick={call.toggleCam}
            aria-label={call.camOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {call.camOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
          </button>
          <button className="vc-btn hang" onClick={() => void leave(false)} aria-label="Leave call">
            <PhoneOff size={20} />
          </button>
          {isDoctor && (
            <button className="vc-cta" onClick={() => void leave(true)} style={{ marginLeft: 10 }}>
              End &amp; mark complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

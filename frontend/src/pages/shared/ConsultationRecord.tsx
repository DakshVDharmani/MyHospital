import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  FileDown,
  Loader2,
  Pencil,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useProfile } from '../../lib/useProfile';
import { doctorNav } from '../Doctor/nav';
import { patientNav } from '../Patient/nav';
import {
  EMPTY_SUMMARY,
  fetchConsultationRecord,
  flattenSummary,
  updateConsultationRecord,
  type ConsultationRecord as Rec,
  type ConsultationSummary,
} from '../../lib/consultations';
import { downloadConsultationPdf, downloadConsultationTxt } from '../../lib/consultationDoc';
import '../../components/dashboard.css';

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function medsToText(s: ConsultationSummary): string {
  return s.medications.map((m) => [m.name, m.dose, m.instructions].join(' | ')).join('\n');
}
function textToMeds(t: string): ConsultationSummary['medications'] {
  return t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name = '', dose = '', instructions = ''] = l.split('|').map((x) => x.trim());
      return { name, dose, instructions };
    })
    .filter((m) => m.name);
}
const linesToText = (a: string[]) => a.join('\n');
const textToLines = (t: string) =>
  t.split('\n').map((x) => x.trim()).filter(Boolean);

export default function ConsultationRecordPage() {
  const { recordId = '' } = useParams();
  const navigate = useNavigate();
  const { role, name, loading: profileLoading } = useProfile();
  const isDoctor = role === 'doctor';

  const [rec, setRec] = useState<Rec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ConsultationSummary>(EMPTY_SUMMARY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetchConsultationRecord(recordId);
      if (!r) setErr('This consultation record was not found, or you don’t have access to it.');
      else setRec(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  // While the summary is still being generated, quietly re-check.
  useEffect(() => {
    if (!rec || rec.summaryStatus !== 'pending') return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [rec, load]);

  const startEdit = () => {
    if (!rec) return;
    setDraft(rec.summary);
    setEditing(true);
  };

  const save = async (finalise: boolean) => {
    if (!rec) return;
    setSaving(true);
    try {
      const summary = draft;
      const updated = await updateConsultationRecord(rec.id, {
        summary,
        summaryText: flattenSummary(summary),
        summaryStatus: 'ready',
        ...(finalise ? { status: 'final' as const } : {}),
      });
      setRec(updated);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const navItems = useMemo(
    () => (isDoctor ? doctorNav('Appointments') : patientNav('Medical Records')),
    [isDoctor],
  );

  const s = rec?.summary ?? EMPTY_SUMMARY;
  const hasStructured =
    !!s.reason || !!s.assessment || s.advice.length > 0 || s.medications.length > 0;

  return (
    <DashboardLayout
      roleLabel={isDoctor ? 'Doctor' : 'Patient'}
      name={profileLoading ? '…' : isDoctor ? `Dr. ${name}` : name}
      eyebrow={isDoctor ? 'Clinician Portal' : 'Patient Portal'}
      pageTitle="Consultation record"
      navItems={navItems}
    >
      <style>{`
        .dc-spin { animation: cr-spin 1s linear infinite; }
        @keyframes cr-spin { to { transform: rotate(360deg); } }
        .cr-head { display:flex; align-items:flex-start; gap:14px; flex-wrap:wrap; margin-bottom:18px; }
        .cr-back { display:inline-flex; align-items:center; gap:6px; background:#fff; border:1.5px solid #DCEBE8;
          color:#0B2B3C; border-radius:9px; padding:8px 12px; font-size:12px; font-weight:800; cursor:pointer; }
        .cr-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap; }
        .cr-btn { display:inline-flex; align-items:center; gap:7px; border-radius:10px; padding:9px 13px;
          font-size:12.5px; font-weight:800; cursor:pointer; border:1.5px solid #DCEBE8; background:#fff; color:#0B2B3C; }
        .cr-btn.primary { background:#0E9C8F; border-color:#0E9C8F; color:#fff; }
        .cr-btn:disabled { opacity:0.55; cursor:default; }
        .cr-meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px 22px; }
        .cr-meta div span { display:block; font-size:10.5px; font-weight:800; text-transform:uppercase;
          letter-spacing:0.4px; color:#5C7680; margin-bottom:2px; }
        .cr-meta div p { margin:0; font-size:13px; font-weight:600; color:#10262E; }
        .cr-sec-title { font-family:'Fraunces','Manrope',serif; font-weight:600; font-size:15px; color:#0B2B3C; margin:0 0 8px; }
        .cr-field { margin-bottom:12px; }
        .cr-field .lbl { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.4px; color:#5C7680; }
        .cr-field p { margin:3px 0 0; font-size:13px; line-height:1.6; color:#10262E; }
        .cr-list { margin:4px 0 0; padding-left:18px; }
        .cr-list li { font-size:13px; line-height:1.7; color:#10262E; }
        .cr-ta { width:100%; border:1.5px solid #DCEBE8; border-radius:10px; padding:10px; font-family:inherit;
          font-size:12.5px; line-height:1.6; color:#10262E; outline:none; resize:vertical; }
        .cr-transcript { white-space:pre-wrap; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size:12px; line-height:1.7; color:#22333B; background:#F6FAF9; border:1px solid #DCEBE8;
          border-radius:12px; padding:14px; max-height:460px; overflow:auto; }
        .cr-flag { color:#b23b34; }
      `}</style>

      {loading ? (
        <div className="dc-card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Loader2 className="dc-spin" size={16} /> Loading record…
        </div>
      ) : err ? (
        <div className="dc-card">
          <div className="dc-card-title">Can’t open this record</div>
          <p className="dc-card-sub">{err}</p>
          <button className="cr-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={13} /> Go back
          </button>
        </div>
      ) : rec ? (
        <>
          <div className="cr-head">
            <button className="cr-back" onClick={() => navigate(-1)}>
              <ArrowLeft size={13} /> Back
            </button>
            <div className="cr-actions">
              <button className="cr-btn" onClick={() => downloadConsultationTxt(rec)}>
                <FileText size={14} /> Transcript (.txt)
              </button>
              <button className="cr-btn primary" onClick={() => downloadConsultationPdf(rec)}>
                <FileDown size={14} /> Download PDF
              </button>
              {isDoctor && !editing && (
                <button className="cr-btn" onClick={startEdit}>
                  <Pencil size={13} /> Edit summary
                </button>
              )}
            </div>
          </div>

          <div className="dc-card dc-section">
            <div className="dc-card-title">{rec.title}</div>
            <div className="dc-card-sub" style={{ marginBottom: 14 }}>
              {rec.status === 'final' ? (
                <span className="dc-pill">
                  <ShieldCheck size={11} /> Finalised by clinician
                </span>
              ) : (
                <span className="dc-pill dc-pill-amber">Draft</span>
              )}{' '}
              {rec.summaryStatus === 'pending' && (
                <span className="dc-pill dc-pill-blue">Summary generating…</span>
              )}
              {rec.summaryStatus === 'failed' && (
                <span className="dc-pill dc-pill-red">Auto-summary unavailable</span>
              )}
              {rec.summaryStatus === 'skipped' && (
                <span className="dc-pill dc-pill-grey">No summary — short visit</span>
              )}
            </div>
            <div className="cr-meta">
              <div>
                <span>Patient</span>
                <p>{rec.patientName || '—'}</p>
              </div>
              <div>
                <span>Doctor</span>
                <p>{rec.doctorName || '—'}</p>
              </div>
              <div>
                <span>Reason</span>
                <p>{rec.reason || '—'}</p>
              </div>
              <div>
                <span>Started</span>
                <p>{fmt(rec.startedAt)}</p>
              </div>
              <div>
                <span>Ended</span>
                <p>{fmt(rec.endedAt)}</p>
              </div>
            </div>
          </div>

          {/* ---- Summary ---- */}
          <div className="dc-card dc-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h2 className="cr-sec-title" style={{ margin: 0 }}>
                Summary &amp; advice
              </h2>
              {rec.summaryStatus === 'pending' && (
                <button
                  className="cr-btn"
                  style={{ marginLeft: 'auto', padding: '6px 10px' }}
                  onClick={() => void load()}
                >
                  <RefreshCw size={12} /> Check again
                </button>
              )}
            </div>

            {editing ? (
              <>
                {(
                  [
                    ['patientSummary', 'In plain language (for the patient)'],
                    ['reason', 'Reason for visit'],
                    ['history', 'History'],
                    ['examination', 'Examination / findings'],
                    ['assessment', 'Assessment'],
                  ] as const
                ).map(([k, label]) => (
                  <div className="cr-field" key={k}>
                    <div className="lbl">{label}</div>
                    <textarea
                      className="cr-ta"
                      rows={k === 'patientSummary' ? 3 : 2}
                      value={draft[k]}
                      onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="cr-field">
                  <div className="lbl">Doctor’s advice — one per line</div>
                  <textarea
                    className="cr-ta"
                    rows={4}
                    value={linesToText(draft.advice)}
                    onChange={(e) => setDraft((d) => ({ ...d, advice: textToLines(e.target.value) }))}
                  />
                </div>
                <div className="cr-field">
                  <div className="lbl">Medications — “name | dose | instructions” per line</div>
                  <textarea
                    className="cr-ta"
                    rows={3}
                    value={medsToText(draft)}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, medications: textToMeds(e.target.value) }))
                    }
                  />
                </div>
                <div className="cr-field">
                  <div className="lbl">Follow-up</div>
                  <textarea
                    className="cr-ta"
                    rows={2}
                    value={draft.followUp}
                    onChange={(e) => setDraft((d) => ({ ...d, followUp: e.target.value }))}
                  />
                </div>
                <div className="cr-field">
                  <div className="lbl">Seek urgent care if — one per line</div>
                  <textarea
                    className="cr-ta"
                    rows={3}
                    value={linesToText(draft.redFlags)}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, redFlags: textToLines(e.target.value) }))
                    }
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="cr-btn" disabled={saving} onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button className="cr-btn" disabled={saving} onClick={() => void save(false)}>
                    {saving ? <Loader2 className="dc-spin" size={13} /> : <Check size={13} />} Save
                  </button>
                  <button
                    className="cr-btn primary"
                    disabled={saving}
                    onClick={() => void save(true)}
                  >
                    <ShieldCheck size={13} /> Save &amp; finalise
                  </button>
                </div>
              </>
            ) : hasStructured || rec.summaryText ? (
              <>
                {s.patientSummary && (
                  <div className="cr-field">
                    <div className="lbl">In plain language</div>
                    <p>{s.patientSummary}</p>
                  </div>
                )}
                {s.reason && (
                  <div className="cr-field">
                    <div className="lbl">Reason for visit</div>
                    <p>{s.reason}</p>
                  </div>
                )}
                {s.history && (
                  <div className="cr-field">
                    <div className="lbl">History</div>
                    <p>{s.history}</p>
                  </div>
                )}
                {s.examination && (
                  <div className="cr-field">
                    <div className="lbl">Examination / findings</div>
                    <p>{s.examination}</p>
                  </div>
                )}
                {s.assessment && (
                  <div className="cr-field">
                    <div className="lbl">Assessment</div>
                    <p>{s.assessment}</p>
                  </div>
                )}
                {s.advice.length > 0 && (
                  <div className="cr-field">
                    <div className="lbl">Doctor’s advice</div>
                    <ul className="cr-list">
                      {s.advice.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.medications.length > 0 && (
                  <div className="cr-field">
                    <div className="lbl">Medications</div>
                    <ul className="cr-list">
                      {s.medications.map((m, i) => (
                        <li key={i}>
                          <strong>{m.name}</strong>
                          {m.dose ? ` — ${m.dose}` : ''}
                          {m.instructions ? ` — ${m.instructions}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.followUp && (
                  <div className="cr-field">
                    <div className="lbl">Follow-up</div>
                    <p>{s.followUp}</p>
                  </div>
                )}
                {s.redFlags.length > 0 && (
                  <div className="cr-field">
                    <div className="lbl cr-flag">Seek urgent care if</div>
                    <ul className="cr-list">
                      {s.redFlags.map((f, i) => (
                        <li key={i} className="cr-flag">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!hasStructured && rec.summaryText && <p className="cr-field">{rec.summaryText}</p>}
              </>
            ) : (
              <p className="dc-card-sub">
                {rec.summaryStatus === 'pending'
                  ? 'The structured summary is being generated from the transcript. This usually takes a few seconds.'
                  : 'No automatic summary is available for this visit. The full transcript below is the complete record.'}
              </p>
            )}
          </div>

          {/* ---- Transcript ---- */}
          <div className="dc-card dc-section">
            <button
              onClick={() => setShowTranscript((v) => !v)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 800,
                fontSize: 13.5,
                color: '#0B2B3C',
              }}
            >
              {showTranscript ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Full meeting transcript
              <span className="dc-pill dc-pill-grey" style={{ marginLeft: 6 }}>
                {rec.transcript.trim() ? `${rec.transcript.trim().split('\n').length} lines` : 'empty'}
              </span>
            </button>
            {showTranscript && (
              <div className="cr-transcript" style={{ marginTop: 12 }}>
                {rec.transcript.trim() || 'No speech was captured for this visit.'}
              </div>
            )}
          </div>
        </>
      ) : null}
    </DashboardLayout>
  );
}

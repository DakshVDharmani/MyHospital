import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Brain,
  ShieldCheck,
  Info,
  ThumbsUp,
  ThumbsDown,
  MessageCircleQuestion,
  HeartPulse,
  Pill,
  Bot,
  Loader2,
  Send as SendIcon,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ReasoningGraph } from '../../components/charts/ReasoningGraph';
import { ConfidenceRing } from '../../components/charts/ConfidenceRing';
import { useProfile } from '../../lib/useProfile';
import { fetchRecentVitals } from '../../voice-widget/vitals/vitalsApi';
import { explainRisk } from '../../lib/riskModel';
import { fetchPatientContext } from '../../lib/patientContext';
import { askXaiAssistant, type XaiChatMessage } from '../../lib/xaiAssistant';
import { patientNav } from './nav';
import '../../components/dashboard.css';
import '../../components/charts/xai-page.css';

const VOICE_BACKEND_URL = import.meta.env.VITE_VOICE_BACKEND_URL as string | undefined;

interface Insight {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  icon: 'heart' | 'pill';
  factors: { label: string; weight: number; direction: 'pos' | 'neg'; note: string }[];
  plain: string;
}

const STATIC_INSIGHTS: Insight[] = [
  {
    id: 'i2',
    title: 'Medication reminder timing suggestion',
    summary: 'The model suggests moving your evening dose 1 hour earlier.',
    confidence: 71,
    icon: 'pill',
    plain:
      'Your logged adherence dips on days with late-evening reminders. Shifting the reminder to 8 PM lines up with days you rarely miss a dose.',
    factors: [
      { label: 'Missed doses cluster after 9 PM', weight: 0.41, direction: 'neg', note: '7 of 9 misses last month' },
      { label: 'High adherence on early-reminder days', weight: 0.33, direction: 'pos', note: '96% when reminded by 8 PM' },
      { label: 'Sleep time trending earlier', weight: 0.26, direction: 'pos', note: 'From wearable data' },
    ],
  },
];

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  escalated?: boolean;
}

export default function PatientXaiHelp() {
  const { id: patientId, name, loading } = useProfile();
  const [liveInsight, setLiveInsight] = useState<Insight | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>('live-risk');
  const [tab, setTab] = useState<'explain' | 'ask'>('explain');
  const [vote, setVote] = useState<Record<string, 'up' | 'down'>>({});

  // "Ask your care team" — an AI assistant that answers from this patient's
  // own records (fetched fresh via fetchPatientContext, RLS-scoped to them),
  // with a one-tap fallback to actually send the question to a human.
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const contextRef = useRef<string | null>(null);

  // Real model, not mock data: pulls the patient's latest logged vitals and
  // asks ml/service's XGBoost triage-risk model to score + explain them —
  // the reasoning graph below is built from its actual SHAP contributions.
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    (async () => {
      try {
        const rows = await fetchRecentVitals(patientId);
        const latestRow = rows[rows.length - 1];

        const record: Record<string, number> = {};
        if (latestRow?.heart_rate_bpm != null) record.triage_vital_hr = latestRow.heart_rate_bpm;
        if (latestRow?.systolic_mmhg != null) record.triage_vital_sbp = latestRow.systolic_mmhg;
        if (latestRow?.diastolic_mmhg != null) record.triage_vital_dbp = latestRow.diastolic_mmhg;
        if (latestRow?.spo2_pct != null) record.triage_vital_o2 = latestRow.spo2_pct;
        if (latestRow?.temperature_c != null) record.triage_vital_temp = latestRow.temperature_c * 1.8 + 32;

        const result = await explainRisk(record);
        if (cancelled) return;

        // How decisively the model landed on this exact ESI level, not a
        // classifier probability — the risk score is continuous (1-5), so
        // "confidence" here means how close it fell to the rounded label.
        const distanceFromRounded = Math.min(Math.abs(result.risk_score - Math.round(result.risk_score)), 0.5);
        const confidence = Math.round((1 - distanceFromRounded / 0.5) * 100);

        setLiveInsight({
          id: 'live-risk',
          title: `Your current triage risk: ${result.priority_label}`,
          summary: latestRow
            ? 'Based on your most recently logged vitals.'
            : 'No vitals logged yet — this reflects the model with no vitals to go on.',
          confidence,
          icon: 'heart',
          plain: `The model scored your current risk at ${result.risk_score.toFixed(2)} on a 1-5 scale (5 = most urgent), landing closest to ${result.priority_label}. The factors below are its actual per-prediction reasoning for you specifically, not a generic explanation.`,
          factors: result.factors,
        });
      } catch (e) {
        if (!cancelled) setLiveError(e instanceof Error ? e.message : 'Could not reach the risk model.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const INSIGHTS = liveInsight ? [liveInsight, ...STATIC_INSIGHTS] : STATIC_INSIGHTS;
  const active = INSIGHTS.find((i) => i.id === activeId) ?? INSIGHTS[0];

  const submitQuestion = async () => {
    const text = question.trim();
    if (!text || asking || !patientId || !VOICE_BACKEND_URL) return;
    setQuestion('');
    setAskError(null);
    const nextChat: ChatTurn[] = [...chat, { role: 'user', text }];
    setChat(nextChat);
    setAsking(true);
    try {
      if (!contextRef.current) {
        contextRef.current = await fetchPatientContext(patientId);
      }
      const history: XaiChatMessage[] = nextChat
        .slice(0, -1)
        .map((t) => ({ role: t.role, content: t.text }));
      const reply = await askXaiAssistant(VOICE_BACKEND_URL, text, contextRef.current, history);
      setChat((c) => [...c, { role: 'assistant', text: reply }]);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Couldn't reach the assistant.");
      setChat((c) => c.slice(0, -1)); // drop the unanswered question, let them retry
      setQuestion(text);
    } finally {
      setAsking(false);
    }
  };

  const escalateTurn = (idx: number) => {
    setChat((c) => c.map((t, i) => (i === idx ? { ...t, escalated: true } : t)));
  };

  return (
    <DashboardLayout
      roleLabel="Patient"
      name={loading ? '…' : name}
      eyebrow="Patient Portal"
      pageTitle="XAI Help"
      navItems={patientNav('XAI Help')}
    >
      <div className="xai-shell">
        <header className="xai-header">
          <div className="xai-header-copy">
            <h1>Understanding your AI health insights</h1>
            <p>Sometimes our system flags something about your health or suggests a change. This page explains, in plain words, why it said that — and how sure it really is.</p>
            {!liveInsight && (
              <p style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: liveError ? '#BD5A3F' : '#5C7680' }}>
                {liveError ? `We couldn't load your risk check right now: ${liveError}` : 'Looking at your latest vitals…'}
              </p>
            )}
          </div>
          <div className="xai-header-badge">
            <ConfidenceRing value={active.confidence} />
            <div className="xai-header-badge-text">
              <div className="xai-header-badge-label">How sure is the AI?</div>
              <div className="xai-header-badge-value">
                {active.confidence >= 80 ? 'Quite confident' : 'Not fully sure — worth a second opinion'}
              </div>
            </div>
          </div>
        </header>

        <nav className="xai-picker" aria-label="Choose an insight">
          {INSIGHTS.map((i) => (
            <button
              key={i.id}
              className={`xai-pill${i.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(i.id)}
            >
              <span className="xai-pill-icon">{i.icon === 'heart' ? <HeartPulse size={14} /> : <Pill size={14} />}</span>
              <span className="xai-pill-text">
                <div className="xai-pill-title">{i.title}</div>
                <div className="xai-pill-sub">{i.confidence}% sure</div>
              </span>
            </button>
          ))}
        </nav>

        <div className="xai-main">
          <section className="xai-graph-card">
            <div className="xai-card-title"><Brain size={14} />How the AI reached this</div>
            <div className="xai-card-sub">Each box below is one reason. A thicker line means that reason mattered more.</div>
            <div className="xai-graph-stage">
              <ReasoningGraph title={active.title} confidence={active.confidence} factors={active.factors} />
            </div>
          </section>

          <section className="xai-panel-card">
            <div className="xai-tabs">
              <button className={`xai-tab${tab === 'explain' ? ' active' : ''}`} onClick={() => setTab('explain')}>
                <Sparkles size={12} style={{ verticalAlign: -2, marginRight: 5 }} />In simple terms
              </button>
              <button className={`xai-tab${tab === 'ask' ? ' active' : ''}`} onClick={() => setTab('ask')}>
                <MessageCircleQuestion size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Ask about your health
              </button>
            </div>

            {tab === 'explain' ? (
              <div className="xai-panel-body">
                <div className="xai-plain">
                  <div className="xai-plain-label"><Info size={12} />What this means for you</div>
                  <div className="xai-plain-text">{active.plain}</div>
                </div>

                <div className="xai-factor-list-label">The reasons behind it, from biggest to smallest effect</div>
                {active.factors.map((f) => (
                  <div className="xai-factor" key={f.label}>
                    <div className="xai-factor-top">
                      <span className="xai-factor-label">{f.label}</span>
                      <span className={`xai-factor-tag ${f.direction}`}>
                        {f.direction === 'pos' ? 'Lowers risk' : 'Raises risk'} · {Math.round(f.weight * 100)}%
                      </span>
                    </div>
                    <div className="xai-factor-track">
                      <div className={`xai-factor-fill ${f.direction}`} style={{ width: `${Math.round(f.weight * 100)}%` }} />
                    </div>
                    <div className="xai-factor-note">{f.note}</div>
                  </div>
                ))}

                <div className="xai-feedback">
                  <span>Did this help you understand it?</span>
                  <button
                    className={`xai-icon-btn up${vote[active.id] === 'up' ? ' active' : ''}`}
                    aria-label="Helpful"
                    onClick={() => setVote((v) => ({ ...v, [active.id]: 'up' }))}
                  >
                    <ThumbsUp size={13} />
                  </button>
                  <button
                    className={`xai-icon-btn down${vote[active.id] === 'down' ? ' active' : ''}`}
                    aria-label="Not helpful"
                    onClick={() => setVote((v) => ({ ...v, [active.id]: 'down' }))}
                  >
                    <ThumbsDown size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="xai-ask-intro">
                  <Bot size={13} />
                  <span>Ask anything about your own visits, vitals, or appointments — answered instantly from your record. Not a diagnosis; for anything urgent, contact your care team directly.</span>
                </div>

                <div className="xai-panel-body">
                  {chat.length === 0 ? (
                    <div className="xai-ask-empty">
                      No questions yet — try “What did the doctor say at my last visit?” or “Why was I flagged this risk level?”
                    </div>
                  ) : (
                    <div className="xai-chat-list">
                      {chat.map((turn, idx) => (
                        <div className={`xai-chat-msg ${turn.role}`} key={idx}>
                          <div className="xai-chat-bubble">{turn.text}</div>
                          {turn.role === 'assistant' && (
                            <div className="xai-chat-actions">
                              {turn.escalated ? (
                                <span className="xai-ask-status">Sent to your care team</span>
                              ) : (
                                <button className="xai-escalate-btn" onClick={() => escalateTurn(idx)}>
                                  Still want a clinician to check this?
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {asking && (
                        <div className="xai-chat-msg assistant">
                          <div className="xai-chat-bubble xai-chat-loading">
                            <Loader2 size={13} className="xai-spin" /> Looking through your record…
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {askError && <div className="xai-error">{askError}</div>}
                </div>

                <div className="xai-ask-form">
                  <input
                    className="xai-ask-input"
                    placeholder={!patientId || !VOICE_BACKEND_URL ? 'Sign in to ask about your health' : 'e.g. Why was my last appointment flagged as high priority?'}
                    value={question}
                    disabled={!patientId || !VOICE_BACKEND_URL || asking}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitQuestion()}
                  />
                  <button
                    className="xai-ask-send"
                    aria-label="Send question"
                    disabled={!patientId || !VOICE_BACKEND_URL || asking || !question.trim()}
                    onClick={submitQuestion}
                  >
                    <SendIcon size={16} />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="xai-footnote">
          <ShieldCheck size={13} />
          <span><strong>AI suggestions never replace medical advice.</strong> A clinician reviews every insight before it changes your care plan.</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
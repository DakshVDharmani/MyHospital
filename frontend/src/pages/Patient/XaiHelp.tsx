import { useState } from 'react';
import {
  Sparkles,
  Brain,
  ShieldCheck,
  Info,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  MessageCircleQuestion,
  HeartPulse,
  Pill,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ReasoningGraph } from '../../components/charts/ReasoningGraph';
import { ConfidenceRing } from '../../components/charts/ConfidenceRing';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';
import '../../components/dashboard.css';
import '../../components/charts/xai-page.css';

interface Insight {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  icon: 'heart' | 'pill';
  factors: { label: string; weight: number; direction: 'pos' | 'neg'; note: string }[];
  plain: string;
}

const INSIGHTS: Insight[] = [
  {
    id: 'i1',
    title: 'Your cardiovascular risk is low this quarter',
    summary: 'Based on your vitals, labs and activity over the last 90 days.',
    confidence: 88,
    icon: 'heart',
    plain:
      'Your blood pressure and resting heart rate have stayed within a healthy band, and your recent lipid panel improved. Keeping up your current activity level is the single biggest driver keeping this estimate low.',
    factors: [
      { label: 'Blood pressure in optimal range', weight: 0.34, direction: 'pos', note: '118/76 avg over 30 days' },
      { label: 'Weekly activity ≥ 150 min', weight: 0.27, direction: 'pos', note: 'Consistent 6 of last 8 weeks' },
      { label: 'LDL cholesterol slightly elevated', weight: 0.19, direction: 'neg', note: '128 mg/dL on 24 Aug panel' },
      { label: 'Family history noted', weight: 0.12, direction: 'neg', note: 'Contributes a fixed baseline' },
      { label: 'Non-smoker', weight: 0.08, direction: 'pos', note: 'Confirmed at last visit' },
    ],
  },
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

export default function PatientXaiHelp() {
  const { name, loading } = useProfile();
  const [activeId, setActiveId] = useState(INSIGHTS[0].id);
  const [tab, setTab] = useState<'explain' | 'ask'>('explain');
  const [vote, setVote] = useState<Record<string, 'up' | 'down'>>({});
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string[]>([]);

  const active = INSIGHTS.find((i) => i.id === activeId)!;

  const submitQuestion = () => {
    if (!question.trim()) return;
    setAsked((a) => [question.trim(), ...a]);
    setQuestion('');
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
            <h1>Why the AI said that</h1>
            <p>Whenever our system makes a health suggestion, this page shows exactly which of your data points pushed it — and how sure the model is.</p>
          </div>
          <div className="xai-header-badge">
            <ConfidenceRing value={active.confidence} />
            <div className="xai-header-badge-text">
              <div className="xai-header-badge-label">Model confidence</div>
              <div className="xai-header-badge-value">
                {active.confidence >= 80 ? 'High agreement' : 'Worth confirming'}
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
                <div className="xai-pill-sub">{i.confidence}% confidence</div>
              </span>
            </button>
          ))}
        </nav>

        <div className="xai-main">
          <section className="xai-graph-card">
            <div className="xai-card-title"><Brain size={14} />How the AI got here</div>
            <div className="xai-card-sub">Every factor points into the conclusion it produced — thicker line, stronger pull</div>
            <div className="xai-graph-stage">
              <ReasoningGraph title={active.title} confidence={active.confidence} factors={active.factors} />
            </div>
          </section>

          <section className="xai-panel-card">
            <div className="xai-tabs">
              <button className={`xai-tab${tab === 'explain' ? ' active' : ''}`} onClick={() => setTab('explain')}>
                <Sparkles size={12} style={{ verticalAlign: -2, marginRight: 5 }} />What drove this
              </button>
              <button className={`xai-tab${tab === 'ask' ? ' active' : ''}`} onClick={() => setTab('ask')}>
                <MessageCircleQuestion size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Ask your care team
              </button>
            </div>

            {tab === 'explain' ? (
              <div className="xai-panel-body">
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

                <div className="xai-plain">
                  <div className="xai-plain-label"><Info size={12} />In plain language</div>
                  <div className="xai-plain-text">{active.plain}</div>
                </div>

                <div className="xai-feedback">
                  <span>Was this explanation helpful?</span>
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
                <div className="xai-ask-form">
                  <input
                    className="xai-ask-input"
                    placeholder="e.g. Why does family history still count if my labs are good?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitQuestion()}
                  />
                  <button className="xai-ask-send" aria-label="Send question" onClick={submitQuestion}>
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="xai-panel-body">
                  {asked.length === 0 ? (
                    <div className="xai-ask-empty">No questions sent yet. Anything you ask here goes straight to your care team, along with this explanation.</div>
                  ) : (
                    <div className="xai-ask-list">
                      {asked.map((q, idx) => (
                        <div className="xai-ask-item" key={idx}>
                          <div>
                            <div className="xai-ask-item-text">{q}</div>
                            <div className="xai-ask-item-sub">Sent with this insight attached</div>
                          </div>
                          <span className="xai-ask-status">Pending</span>
                        </div>
                      ))}
                    </div>
                  )}
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
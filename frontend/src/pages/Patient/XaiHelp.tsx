import { useState } from 'react';
import {
  Sparkles,
  Brain,
  ShieldCheck,
  Info,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';
import '../../components/dashboard.css';

interface Insight {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  factors: { label: string; weight: number; direction: 'pos' | 'neg'; note: string }[];
  plain: string;
}

const INSIGHTS: Insight[] = [
  {
    id: 'i1',
    title: 'Your cardiovascular risk is low this quarter',
    summary: 'Based on your vitals, labs and activity over the last 90 days.',
    confidence: 88,
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
  const [vote, setVote] = useState<Record<string, 'up' | 'down'>>({});
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string[]>([]);

  const active = INSIGHTS.find((i) => i.id === activeId)!;

  return (
    <DashboardLayout
      roleLabel="Patient"
      name={loading ? '…' : name}
      eyebrow="Patient Portal"
      pageTitle="XAI Help"
      navItems={patientNav('XAI Help')}
    >
      <div className="dc-page-intro">
        <h1>Explainable AI help</h1>
        <p>Whenever our system makes a health suggestion, this page shows you exactly <em>why</em> — which of your data points pushed the estimate up or down, and how sure the model is.</p>
      </div>

      <div className="dc-grid dc-grid-2 dc-section" style={{ alignItems: 'start' }}>
        <div className="dc-card">
          <div className="dc-card-title"><Brain size={14} style={{ verticalAlign: -2, marginRight: 6 }} />AI insights about you</div>
          <div className="dc-card-sub">Select one to see the full explanation</div>
          <div className="dc-list">
            {INSIGHTS.map((i) => (
              <button
                key={i.id}
                className="dc-list-item"
                style={{ cursor: 'pointer', border: i.id === activeId ? '1px solid #0E9C8F' : undefined, background: i.id === activeId ? '#fff' : undefined }}
                onClick={() => setActiveId(i.id)}
              >
                <div className="dc-list-item-main">
                  <div className="dc-list-avatar"><Sparkles size={15} /></div>
                  <div>
                    <div className="dc-list-title">{i.title}</div>
                    <div className="dc-list-sub">{i.summary}</div>
                  </div>
                </div>
                <span className="dc-pill dc-pill-blue">{i.confidence}%</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dc-card">
          <div className="dc-confidence" style={{ marginBottom: 18 }}>
            <span className="dc-confidence-num">{active.confidence}%</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0B2B3C' }}>Model confidence</div>
              <div style={{ fontSize: 11.5, color: '#5C7680', fontWeight: 600 }}>
                {active.confidence >= 80 ? 'High — several independent signals agree' : 'Moderate — worth confirming with your clinician'}
              </div>
            </div>
          </div>

          <div className="dc-card-title">What drove this</div>
          <div className="dc-card-sub">Contribution of each factor, largest first</div>
          {active.factors.map((f) => (
            <div className="dc-xai-factor" key={f.label}>
              <div className="dc-xai-factor-top">
                <span>{f.label}</span>
                <span className="dc-xai-weight">{f.direction === 'pos' ? 'lowers risk' : 'raises risk'} · {Math.round(f.weight * 100)}%</span>
              </div>
              <div className="dc-xai-bar">
                <div className={`dc-xai-bar-fill ${f.direction === 'pos' ? 'dc-pos' : 'dc-neg'}`} style={{ width: `${Math.round(f.weight * 100)}%` }} />
              </div>
              <div style={{ fontSize: 11, color: '#5C7680', fontWeight: 500 }}>{f.note}</div>
            </div>
          ))}

          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: '#F2F8F7', border: '1px solid #DCEBE8' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: '#0B7A70', marginBottom: 6 }}>
              <Info size={12} style={{ verticalAlign: -2, marginRight: 5 }} />In plain language
            </div>
            <div style={{ fontSize: 12.5, color: '#10262E', fontWeight: 500, lineHeight: 1.6 }}>{active.plain}</div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5C7680' }}>Was this explanation helpful?</span>
            <button className="dc-icon-action" aria-label="Helpful" style={{ borderColor: vote[active.id] === 'up' ? '#0E9C8F' : undefined, color: vote[active.id] === 'up' ? '#0B7A70' : undefined }} onClick={() => setVote((v) => ({ ...v, [active.id]: 'up' }))}><ThumbsUp size={14} /></button>
            <button className="dc-icon-action" aria-label="Not helpful" style={{ borderColor: vote[active.id] === 'down' ? '#E5544A' : undefined, color: vote[active.id] === 'down' ? '#E5544A' : undefined }} onClick={() => setVote((v) => ({ ...v, [active.id]: 'down' }))}><ThumbsDown size={14} /></button>
          </div>
        </div>
      </div>

      <div className="dc-section">
        <div className="dc-card">
          <div className="dc-card-title">Ask about this insight</div>
          <div className="dc-card-sub">Your question goes to your care team along with the explanation above</div>
          <div className="dc-chat-compose" style={{ padding: 0, border: 'none' }}>
            <input
              placeholder="e.g. Why does family history still count if my labs are good?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && question.trim()) { setAsked((a) => [question.trim(), ...a]); setQuestion(''); }
              }}
            />
            <button
              className="dc-chat-send"
              aria-label="Send question"
              onClick={() => { if (question.trim()) { setAsked((a) => [question.trim(), ...a]); setQuestion(''); } }}
            >
              <ArrowRight size={16} />
            </button>
          </div>
          {asked.length > 0 && (
            <div className="dc-list" style={{ marginTop: 14 }}>
              {asked.map((q, idx) => (
                <div className="dc-list-item" key={idx}>
                  <div className="dc-list-item-main">
                    <div className="dc-list-avatar">?</div>
                    <div><div className="dc-list-title">{q}</div><div className="dc-list-sub">Sent to your care team</div></div>
                  </div>
                  <span className="dc-pill dc-pill-amber">Pending</span>
                </div>
              ))}
            </div>
          )}
          <div className="dc-chart-legend-note" style={{ marginTop: 14 }}>
            <ShieldCheck size={12} style={{ verticalAlign: -2, marginRight: 5 }} />
            AI suggestions never replace medical advice. A clinician reviews every insight before it changes your care plan.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

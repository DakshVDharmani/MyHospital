import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  compact,
  relativeTime,
  titleCase,
  useAdminMetrics,
  type AdminMetrics,
  type Slice,
} from '../../lib/analytics';
import './analytics.css';

/* validated dark categorical steps + status/acuity palette */
const CAT = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#2f9e2f', '#9085e9', '#e66767'];
const ACUITY: Record<string, string> = {
  critical: '#d03b3b',
  urgent: '#ec835a',
  moderate: '#fab219',
  stable: '#0ca30c',
};
const catFor = (i: number) => CAT[i % CAT.length];

// ---------------------------------------------------------------- tooltip
type TipState = { x: number; y: number; title: string; body: string } | null;

function Tip({ tip }: { tip: TipState }) {
  if (!tip) return null;
  return (
    <div className="hx-tip" style={{ left: tip.x, top: tip.y }}>
      <b>{tip.title}</b>
      {tip.body}
    </div>
  );
}

// ---------------------------------------------------------------- card
function Card({
  title,
  insight,
  span,
  children,
}: {
  title: string;
  insight?: ReactNode;
  span?: 4 | 6 | 8 | 12;
  children: ReactNode;
}) {
  return (
    <section className={`hx-card${span ? ` sp${span}` : ''}`}>
      <div className="hx-card-h">
        <h3>{title}</h3>
        {insight && <p className="hx-insight">{insight}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- KPI tile
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 62;
  const h = 20;
  const max = Math.max(...points, 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (points.length - 1)) * w} ${h - (p / max) * h}`)
    .join(' ');
  return (
    <svg className="hx-kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function StatTile({
  label,
  value,
  unit,
  sub,
  tone = 'mut',
  spark,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  tone?: 'up' | 'warn' | 'crit' | 'mut';
  spark?: { points: number[]; color: string };
}) {
  return (
    <div className="hx-kpi">
      <div className="hx-kpi-label">{label}</div>
      <div className="hx-kpi-val">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className={`hx-kpi-sub ${tone}`}>{sub}</div>}
      {spark && <Sparkline points={spark.points} color={spark.color} />}
    </div>
  );
}

// ---------------------------------------------------------------- horizontal bars
function HBars({
  data,
  unit = '',
  colorAt,
  setTip,
}: {
  data: Slice[];
  unit?: string;
  colorAt?: (i: number) => string;
  setTip: (t: TipState) => void;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="hx-rows">
      {data.map((d, i) => (
        <div
          className="hx-row"
          key={d.label}
          onMouseMove={(e) =>
            setTip({ x: e.clientX, y: e.clientY, title: titleCase(d.label), body: `${d.value}${unit}` })
          }
          onMouseLeave={() => setTip(null)}
        >
          <span className="hx-row-label">{titleCase(d.label)}</span>
          <div className="hx-row-track">
            <div
              className="hx-row-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: (colorAt ?? (() => CAT[0]))(i) }}
            />
          </div>
          <span className="hx-row-val">
            {d.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- grouped bars (supply vs demand)
function GroupedBars({
  data,
  setTip,
}: {
  data: { label: string; doctors: number; demand: number }[];
  setTip: (t: TipState) => void;
}) {
  const max = Math.max(...data.map((d) => Math.max(d.doctors, d.demand)), 1);
  return (
    <div className="hx-rows">
      {data.map((d) => (
        <div
          className="hx-row"
          key={d.label}
          onMouseMove={(e) =>
            setTip({
              x: e.clientX,
              y: e.clientY,
              title: titleCase(d.label),
              body: `${d.doctors} providers · ${d.demand} triage demand`,
            })
          }
          onMouseLeave={() => setTip(null)}
        >
          <span className="hx-row-label">{titleCase(d.label)}</span>
          <div className="hx-row-track" style={{ height: 22 }}>
            <div className="hx-row-fill g2" style={{ width: `${(d.doctors / max) * 100}%`, background: CAT[0] }} />
            <div className="hx-row-fill g2 b" style={{ width: `${(d.demand / max) * 100}%`, background: CAT[3] }} />
          </div>
          <span className="hx-row-val">
            {d.doctors}
            <span className="hx-row-val dim"> / {d.demand}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- donut
function Donut({
  data,
  centerLabel,
  setTip,
}: {
  data: { label: string; value: number; color: string }[];
  centerLabel: string;
  setTip: (t: TipState) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segs = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const frac = d.value / (total || 1);
      const seg = { ...d, dash: frac * C, gap: C - frac * C, off: -offset * C, frac };
      offset += frac;
      return seg;
    });
  return (
    <div className="hx-donut-wrap">
      <svg width={132} height={132} viewBox="0 0 132 132">
        <g transform="translate(66 66) rotate(-90)">
          {segs.map((s) => (
            <circle
              key={s.label}
              className="hx-donut-seg"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={16}
              strokeDasharray={`${s.dash} ${s.gap}`}
              strokeDashoffset={s.off}
              onMouseMove={(e) =>
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  title: titleCase(s.label),
                  body: `${s.value} · ${Math.round(s.frac * 100)}%`,
                })
              }
              onMouseLeave={() => setTip(null)}
            />
          ))}
        </g>
        <text className="hx-donut-center" x={66} y={64} textAnchor="middle">
          {total}
        </text>
        <text className="hx-donut-cap" x={66} y={80} textAnchor="middle">
          {centerLabel.toUpperCase()}
        </text>
      </svg>
      <div className="hx-legend" style={{ marginTop: 0, flexDirection: 'column', gap: 7 }}>
        {data.map((d) => (
          <span key={d.label}>
            <i style={{ background: d.color }} />
            {titleCase(d.label)}
            <b style={{ marginLeft: 4, color: 'var(--hx-ink)' }}>{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- vertical histogram
function Histogram({
  data,
  color,
  setTip,
  unitPrefix = '',
}: {
  data: Slice[];
  color: string;
  setTip: (t: TipState) => void;
  unitPrefix?: string;
}) {
  const W = 320;
  const H = 150;
  const pad = { t: 14, r: 6, b: 22, l: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = iw / data.length;
  const bw = Math.min(38, slot * 0.62);
  return (
    <svg className="hx-svg" viewBox={`0 0 ${W} ${H}`} role="img">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line className="hx-grid-line" x1={pad.l} x2={W - pad.r} y1={pad.t + ih - f * ih} y2={pad.t + ih - f * ih} />
          <text className="hx-axis" x={pad.l - 6} y={pad.t + ih - f * ih + 3} textAnchor="end">
            {Math.round(f * max)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const bh = (d.value / max) * ih;
        const x = pad.l + slot * i + (slot - bw) / 2;
        const y = pad.t + ih - bh;
        return (
          <g
            key={d.label}
            onMouseMove={(e) =>
              setTip({ x: e.clientX, y: e.clientY, title: `${unitPrefix}${d.label}`, body: `${d.value}` })
            }
            onMouseLeave={() => setTip(null)}
            style={{ cursor: 'pointer' }}
          >
            <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" />
            <rect x={x} y={y} width={bw} height={Math.max(bh, 2)} rx={4} fill={color} />
            <text className="hx-axis" x={pad.l + slot * i + slot / 2} y={H - 7} textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- area trend
function AreaTrend({
  labels,
  series,
  setTip,
}: {
  labels: string[];
  series: { name: string; color: string; points: number[] }[];
  setTip: (t: TipState) => void;
}) {
  const W = 640;
  const H = 210;
  const pad = { t: 16, r: 16, b: 26, l: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = labels.length;
  const max = Math.max(...series.flatMap((s) => s.points), 1);
  const nice = Math.ceil(max / 200) * 200 || max;
  const x = (i: number) => pad.l + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - (v / nice) * ih;
  const [hi, setHi] = useState<number | null>(null);
  return (
    <>
      <svg className="hx-svg" viewBox={`0 0 ${W} ${H}`} role="img"
        onMouseLeave={() => { setHi(null); setTip(null); }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const idx = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1))));
          setHi(idx);
          setTip({
            x: e.clientX,
            y: e.clientY,
            title: labels[idx],
            body: series.map((s) => `${s.name}: ${s.points[idx]}`).join('  ·  '),
          });
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line className="hx-grid-line" x1={pad.l} x2={W - pad.r} y1={y(f * nice)} y2={y(f * nice)} />
            <text className="hx-axis" x={pad.l - 8} y={y(f * nice) + 3} textAnchor="end">
              {compact(Math.round(f * nice))}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const line = s.points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
          const area = `${line} L ${x(n - 1)} ${pad.t + ih} L ${x(0)} ${pad.t + ih} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={s.color} fillOpacity={0.12} />
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {hi !== null && <circle cx={x(hi)} cy={y(s.points[hi])} r={3.5} fill={s.color} stroke="#12191b" strokeWidth={1.5} />}
            </g>
          );
        })}
        {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={pad.t + ih} stroke="#3b4c50" strokeWidth={1} />}
        {labels.map((lb, i) =>
          i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
            <text key={i} className="hx-axis" x={x(i)} y={H - 8} textAnchor="middle">
              {lb}
            </text>
          ) : null
        )}
      </svg>
      <div className="hx-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- funnel
function Funnel({ steps, setTip }: { steps: { label: string; value: number }[]; setTip: (t: TipState) => void }) {
  const top = Math.max(steps[0]?.value ?? 1, 1);
  return (
    <div className="hx-funnel">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.value : steps[i - 1].value;
        const drop = prev > 0 ? Math.round((1 - s.value / prev) * 100) : 0;
        return (
          <div key={s.label}>
            <div className="hx-funnel-step">
              <span>{s.label}</span>
              <div
                className="hx-funnel-bar"
                style={{ width: `${Math.max((s.value / top) * 100, 6)}%`, background: catFor(i) }}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, title: s.label, body: `${s.value}` })}
                onMouseLeave={() => setTip(null)}
              >
                {s.value}
              </div>
            </div>
            {i > 0 && drop > 0 && <div className="hx-funnel-drop">↓ {drop}% drop-off</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- radial gauge
function Gauge({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const R = 46;
  const C = Math.PI * R; // half circle
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="hx-gauge">
      <svg width={120} height={72} viewBox="0 0 120 72">
        <path d="M 8 64 A 52 52 0 0 1 112 64" fill="none" stroke="#223034" strokeWidth={10} strokeLinecap="round" />
        <path
          d="M 8 64 A 52 52 0 0 1 112 64"
          fill="none"
          stroke={p > 85 ? '#d03b3b' : p > 60 ? '#fab219' : '#2ee6c5'}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * C} ${C}`}
          style={{ transition: 'stroke-dasharray 0.6s' }}
        />
      </svg>
      <div className="hx-gauge-txt">
        <b>{Math.round(p)}%</b>
        <span>{label}</span>
        <span style={{ color: 'var(--hx-ink-2)' }}>{sub}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- geo map
function GeoMap({ states }: { states: AdminMetrics['geo_states'] }) {
  const mount = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mount.current || map.current) return;
    const m = L.map(mount.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView(
      [22.4, 79],
      4.4
    );
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 10 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    const max = Math.max(...states.map((s) => s.n), 1);
    states.forEach((s) => {
      const radius = 10 + (s.n / max) * 26;
      L.circleMarker([s.lat, s.lng], {
        radius,
        color: '#2ee6c5',
        weight: 1.5,
        fillColor: '#3987e5',
        fillOpacity: 0.35,
      })
        .bindTooltip(`<b>${s.state}</b><br/>${s.n} providers`, { direction: 'top' })
        .addTo(layer.current!);
    });
  }, [states]);

  return <div className="hx-map" ref={mount} />;
}

// ---------------------------------------------------------------- activity feed
const FEED_COLOR: Record<string, string> = {
  notification: '#3987e5',
  appointment: '#199e70',
  triage: '#ec835a',
  vitals: '#d55181',
  user: '#9085e9',
};
function ActivityFeed({ items }: { items: AdminMetrics['activity'] }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hx-feed">
      {items.map((it, i) => (
        <div className="hx-feed-item" key={`${it.ts}-${i}`}>
          <span className="hx-feed-dot" style={{ background: FEED_COLOR[it.kind] ?? '#6f8785' }} />
          <span>
            <span className="hx-feed-kind">{it.kind}</span>
            <br />
            <span className="hx-feed-text">{it.text}</span>
          </span>
          <span className="hx-feed-ago">{relativeTime(it.ts)}</span>
        </div>
      ))}
    </div>
  );
}

// ================================================================ workspace
export default function AnalyticsWorkspace() {
  const { metrics: m, error, loading, refreshing, lastUpdated, refresh } = useAdminMetrics();
  const [tip, setTip] = useState<TipState>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const cumulative = useMemo(() => {
    if (!m) return null;
    let cd = 0;
    let cp = 0;
    const labels: string[] = [];
    const docs: number[] = [];
    const pats: number[] = [];
    for (const r of m.registrations) {
      cd += r.doctors;
      cp += r.patients;
      labels.push(r.d);
      docs.push(cd);
      pats.push(cp);
    }
    return { labels, docs, pats };
  }, [m]);

  if (loading) {
    return (
      <div className="hx-state">
        <div className="hx-spinner" />
        Building the live workspace…
      </div>
    );
  }
  if (error && !m) {
    return <div className="hx-err">Could not load analytics: {error}</div>;
  }
  if (!m || !cumulative) return null;

  const k = m.kpis;
  const riskPct = k.avg_risk != null ? (k.avg_risk / 5) * 100 : 0;

  return (
    <>
      <div className="hx-bar">
        <div>
          <h1>Operations intelligence</h1>
          <p>Every metric recomputed live from the clinical database · auto-refresh 15s</p>
        </div>
        <span className="hx-live">LIVE</span>
        <div className="hx-bar-spacer" />
        <span className="hx-stamp">
          {lastUpdated ? `updated ${relativeTime(lastUpdated.toISOString())}` : '—'}
        </span>
        <button className={`hx-btn${refreshing ? ' spin' : ''}`} onClick={refresh} disabled={refreshing}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          Refresh
        </button>
      </div>

      {error && <div className="hx-err">Last refresh failed ({error}) — showing cached figures.</div>}

      <div className="hx-body">
        {/* ---------------- KPI band ---------------- */}
        <div className="hx-kpis">
          <StatTile
            label="Providers"
            value={k.doctors}
            sub={`${k.doctors_active} active · ${k.doctors_leave} on leave`}
            tone="up"
            spark={{ points: cumulative.docs, color: '#3987e5' }}
          />
          <StatTile
            label="Patients"
            value={compact(k.patient_users)}
            sub={`${k.patient_records} detailed records`}
            spark={{ points: cumulative.pats, color: '#9085e9' }}
          />
          <StatTile
            label="Appointments"
            value={k.appts_total}
            sub={`${k.appts_upcoming} upcoming · ${k.appts_completed} completed`}
            tone="mut"
          />
          <StatTile
            label="Triage assessments"
            value={k.triage_total}
            sub={`${k.triage_high} high acuity`}
            tone={k.triage_high > 0 ? 'crit' : 'mut'}
          />
          <StatTile
            label="Mean triage risk"
            value={k.avg_risk?.toFixed(2) ?? '—'}
            unit="/5"
            sub={riskPct > 60 ? 'elevated caseload' : 'within normal band'}
            tone={riskPct > 60 ? 'warn' : 'up'}
          />
          <StatTile
            label="Provider rating"
            value={k.avg_rating?.toFixed(2) ?? '—'}
            unit="★"
            sub={`avg fee ₹${k.avg_fee ?? '—'}`}
            tone="up"
          />
          <StatTile
            label="Capacity used"
            value={`${k.capacity_util ?? 0}`}
            unit="%"
            sub="of weekly provider hours"
            tone={(k.capacity_util ?? 0) > 80 ? 'crit' : 'up'}
          />
          <StatTile
            label="Unread alerts"
            value={k.notif_unread}
            sub={`${k.notif_total} sent · ${k.messages} secure msgs`}
            tone={k.notif_unread > 0 ? 'warn' : 'up'}
          />
        </div>

        {/* ---------------- charts ---------------- */}
        <div className="hx-grid">
          <Card
            span={8}
            title="Network growth"
            insight={
              <>
                Cumulative onboarding — <b>{cumulative.docs[cumulative.docs.length - 1]}</b> providers and{' '}
                <b>{cumulative.pats[cumulative.pats.length - 1]}</b> patients to date.
              </>
            }
          >
            <AreaTrend
              labels={cumulative.labels}
              series={[
                { name: 'Providers', color: '#3987e5', points: cumulative.docs },
                { name: 'Patients', color: '#9085e9', points: cumulative.pats },
              ]}
              setTip={setTip}
            />
          </Card>

          <Card span={4} title="Provider status" insight="Active vs. temporarily unavailable">
            <Donut
              data={[
                { label: 'active', value: k.doctors_active, color: '#0ca30c' },
                { label: 'on leave', value: k.doctors_leave, color: '#fab219' },
              ]}
              centerLabel="providers"
              setTip={setTip}
            />
            <div style={{ marginTop: 14 }}>
              <Gauge pct={k.capacity_util ?? 0} label="Capacity utilisation" sub="load ÷ weekly capacity" />
            </div>
          </Card>

          <Card
            span={8}
            title="Specialist supply vs. live demand"
            insight={
              <>
                Providers per specialty (blue) against triage routing demand (amber). Demand is concentrating in{' '}
                <b>{titleCase(m.supply_demand[0]?.label ?? '')}</b>.
              </>
            }
          >
            <GroupedBars data={m.supply_demand.slice(0, 12)} setTip={setTip} />
            <div className="hx-legend">
              <span>
                <i style={{ background: '#3987e5' }} />
                Providers
              </span>
              <span>
                <i style={{ background: '#c98500' }} />
                Triage demand
              </span>
            </div>
          </Card>

          <Card span={4} title="Acuity mix" insight="Triage need bracket across all assessments">
            <Donut
              data={m.triage_need.map((s) => ({ ...s, color: ACUITY[s.label] ?? '#6f8785' }))}
              centerLabel="assessed"
              setTip={setTip}
            />
          </Card>

          <Card span={6} title="Geographic footprint" insight="Provider coverage by state — bubble size = headcount">
            <GeoMap states={m.geo_states} />
            <div className="hx-map-legend">
              <span>{m.geo_states.length} states</span>
              <span>Top: {m.geo_states[0]?.state} ({m.geo_states[0]?.n})</span>
              <span>{m.geo_points.length} geocoded providers</span>
            </div>
          </Card>

          <Card span={6} title="Providers by state" insight="Where the network is deepest">
            <HBars data={m.doctors_by_state} colorAt={() => '#3987e5'} setTip={setTip} />
          </Card>

          <Card
            span={6}
            title="Consultation funnel"
            insight="From booked appointment to AI-summarised record"
          >
            <Funnel
              steps={[
                { label: 'Appointments', value: m.consult_funnel.appointments },
                { label: 'Meetings started', value: m.consult_funnel.meetings },
                { label: 'Completed', value: m.consult_funnel.completed },
                { label: 'Records captured', value: m.consult_funnel.recorded },
                { label: 'AI-summarised', value: m.consult_funnel.summarized },
              ]}
              setTip={setTip}
            />
          </Card>

          <Card span={6} title="Appointments" insight="Status split and delivery mode">
            <Donut
              data={m.appts_by_status.map((s, i) => ({ ...s, color: catFor(i) }))}
              centerLabel="booked"
              setTip={setTip}
            />
            <div className="hx-legend">
              {m.appts_by_mode.map((s, i) => (
                <span key={s.label}>
                  <i style={{ background: i === 0 ? '#199e70' : '#c98500' }} />
                  {titleCase(s.label)} <b style={{ color: 'var(--hx-ink)' }}>{s.value}</b>
                </span>
              ))}
            </div>
          </Card>

          <Card span={4} title="Triage risk distribution" insight="Assessment count by risk score band (0–5)">
            <Histogram data={m.risk_histogram} color="#ec835a" setTip={setTip} unitPrefix="Risk " />
          </Card>

          <Card span={4} title="Emergency severity index" insight="ESI level assigned at triage">
            <Histogram data={m.triage_esi} color="#3987e5" setTip={setTip} />
          </Card>

          <Card span={4} title="Patient priority" insight="Standing panel priority bracket">
            <Donut
              data={m.patient_priority.map((s) => ({ ...s, color: ACUITY[s.label] ?? '#6f8785' }))}
              centerLabel="patients"
              setTip={setTip}
            />
          </Card>

          <Card span={6} title="Provider experience" insight="Years in practice across the network">
            <Histogram data={m.experience_dist} color="#199e70" setTip={setTip} />
          </Card>

          <Card span={6} title="Provider rating spread" insight="Distribution of patient ratings">
            <Histogram data={m.rating_dist} color="#c98500" setTip={setTip} />
          </Card>

          <Card span={6} title="Busiest providers" insight="Highest weekly load as a share of capacity">
            <div className="hx-rows">
              {m.capacity_top.map((d) => (
                <div
                  className="hx-row"
                  key={d.name}
                  onMouseMove={(e) =>
                    setTip({
                      x: e.clientX,
                      y: e.clientY,
                      title: d.name,
                      body: `${d.load}/${d.capacity} slots · ${titleCase(d.specialty)}`,
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                >
                  <span className="hx-row-label">{d.name.replace(/^Dr\.?\s*/, '')}</span>
                  <div className="hx-row-track">
                    <div
                      className="hx-row-fill"
                      style={{
                        width: `${d.pct}%`,
                        background: d.pct > 85 ? '#d03b3b' : d.pct > 65 ? '#fab219' : '#199e70',
                      }}
                    />
                  </div>
                  <span className="hx-row-val">{d.pct}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card span={6} title="Consultation fees" insight="Mean fee by specialty (₹)">
            <HBars data={m.fee_by_specialty.slice(0, 10)} unit="" colorAt={() => '#3987e5'} setTip={setTip} />
          </Card>

          <Card span={8} title="Notifications by type" insight="What the platform is telling people about">
            <HBars data={m.notif_by_type} colorAt={(i) => catFor(i)} setTip={setTip} />
          </Card>

          <Card span={4} title="Live activity" insight="Newest clinical events across the estate">
            <ActivityFeed items={m.activity} />
          </Card>
        </div>
      </div>

      <Tip tip={tip} />
    </>
  );
}

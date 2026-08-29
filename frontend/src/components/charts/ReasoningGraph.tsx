import { useMemo, useState } from 'react';
import { graphlib, layout as dagreLayout } from 'dagre';
import './charts.css';

export interface ReasoningFactor {
  label: string;
  weight: number; // 0..1 contribution strength
  direction: 'pos' | 'neg';
  note: string;
}

export interface ReasoningGraphProps {
  title: string;
  confidence: number;
  factors: ReasoningFactor[];
}

interface FactorNodeData {
  kind: 'factor';
  factor: ReasoningFactor;
}
interface ConclusionNodeData {
  kind: 'conclusion';
  title: string;
  confidence: number;
}
type NodeData = FactorNodeData | ConclusionNodeData;

const FACTOR_H = 44;
// Palette matches the page tokens in xai-page.css (kept as plain hex here
// since these are drawn inside an <svg>, not styled via CSS custom props).
const POS_COLOR = '#0E7C74'; // lowers risk — teal
const NEG_COLOR = '#BD5A3F'; // raises risk — warm clay, deliberately not alarm-red

function factorWidth(label: string): number {
  return Math.max(126, Math.min(196, label.length * 5.2 + 34));
}

/** Sized from the title itself (like factorWidth) so longer conclusions get
 * more room instead of relying purely on the line-clamp safety net. */
function conclusionSize(title: string): { width: number; height: number } {
  const width = Math.max(160, Math.min(240, title.length * 3.2 + 90));
  const estLines = Math.max(2, Math.ceil((title.length * 5.6) / (width - 28)));
  const height = Math.max(70, Math.min(112, 32 + estLines * 17));
  return { width, height };
}

/**
 * Renders one insight as a small left-to-right reasoning graph: every factor
 * that fed the model points into the conclusion it produced. Dagre computes
 * *where* each box and connector goes (rank order, spacing, edge routing) —
 * this component still draws every rect, label and curve itself.
 */
export function ReasoningGraph({ title, confidence, factors }: ReasoningGraphProps) {
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);

  const { nodes, edges, width, height } = useMemo(() => {
    const g = new graphlib.Graph<NodeData>();
    g.setGraph({ rankdir: 'LR', nodesep: 10, ranksep: 60, marginx: 6, marginy: 6 });
    g.setDefaultEdgeLabel(() => ({}));

    factors.forEach((f, i) => {
      g.setNode(`f${i}`, { width: factorWidth(f.label), height: FACTOR_H, kind: 'factor', factor: f });
    });
    const { width: cW, height: cH } = conclusionSize(title);
    g.setNode('conclusion', { width: cW, height: cH, kind: 'conclusion', title, confidence });

    factors.forEach((f, i) => {
      g.setEdge(`f${i}`, 'conclusion', { weight: Math.max(1, Math.round(f.weight * 10)) });
    });

    dagreLayout(g);

    const graphInfo = g.graph();
    return {
      nodes: g.nodes().map((id) => ({ id, ...(g.node(id) as unknown as NodeData & { x: number; y: number; width: number; height: number }) })),
      edges: g.edges().map((e) => ({ from: e.v, to: e.w })),
      width: graphInfo.width ?? 0,
      height: graphInfo.height ?? 0,
    };
  }, [factors, title, confidence]);

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="chart-graph-wrap">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="chart-graph-svg"
        role="img"
        aria-label={`Reasoning graph showing ${factors.length} factors leading to: ${title}`}
      >
        <defs>
          <marker id="rg-arrow-pos" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={POS_COLOR} />
          </marker>
          <marker id="rg-arrow-neg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={NEG_COLOR} />
          </marker>
          <linearGradient id="rg-conclusion-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#12968A" />
            <stop offset="100%" stopColor="#0B5E58" />
          </linearGradient>
          <filter id="rg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.47  0 0 0 0 0.42  0 0 0 0.35 0" />
          </filter>
        </defs>

        {edges.map(({ from, to }, i) => {
          const a = nodeById[from] as (typeof nodes)[number] & FactorNodeData;
          const b = nodeById[to];
          const x1 = a.x + a.width / 2;
          const y1 = a.y;
          const x2 = b.x - b.width / 2;
          const y2 = b.y;
          const midX = (x1 + x2) / 2;
          const color = a.factor.direction === 'pos' ? POS_COLOR : NEG_COLOR;
          const strokeWidth = 1.5 + a.factor.weight * 4.2;
          const active = hoveredEdge === i;
          return (
            <path
              key={i}
              className="rg-edge"
              style={{ animationDelay: `${i * 60}ms` }}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity={active ? 1 : 0.5}
              markerEnd={`url(#${a.factor.direction === 'pos' ? 'rg-arrow-pos' : 'rg-arrow-neg'})`}
              onMouseEnter={() => setHoveredEdge(i)}
              onMouseLeave={() => setHoveredEdge((h) => (h === i ? null : h))}
            />
          );
        })}

        {nodes.map((n, idx) => {
          const x = n.x - n.width / 2;
          const y = n.y - n.height / 2;
          if (n.kind === 'conclusion') {
            return (
              <g key={n.id} className="rg-node" style={{ animationDelay: `${factors.length * 60 + 80}ms` }} transform={`translate(${x}, ${y})`}>
                <rect width={n.width} height={n.height} rx={16} fill="url(#rg-conclusion-grad)" filter="url(#rg-glow)" opacity={0.9} />
                <rect width={n.width} height={n.height} rx={16} fill="url(#rg-conclusion-grad)" />
                <text x={14} y={21} className="chart-graph-conclusion-label">CONCLUSION</text>
                <foreignObject x={14} y={28} width={n.width - 28} height={n.height - 34}>
                  <div className="chart-graph-conclusion-title">{n.title}</div>
                </foreignObject>
              </g>
            );
          }
          const f = n.factor;
          const color = f.direction === 'pos' ? POS_COLOR : NEG_COLOR;
          return (
            <g key={n.id} className="rg-node" style={{ animationDelay: `${idx * 60}ms` }} transform={`translate(${x}, ${y})`}>
              <rect width={n.width} height={n.height} rx={12} fill="#fff" stroke="#EFE8D9" strokeWidth={1} className="rg-factor-card" />
              <rect width={4} height={n.height} rx={2} fill={color} />
              <foreignObject x={13} y={5} width={n.width - 21} height={n.height - 10}>
                <div className="chart-graph-factor">
                  <div className="chart-graph-factor-label">{f.label}</div>
                  <div className="chart-graph-factor-meta" style={{ color }}>
                    {f.direction === 'pos' ? 'Lowers risk' : 'Raises risk'} · {Math.round(f.weight * 100)}%
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      <div className="chart-graph-legend">
        <span className="chart-graph-legend-item"><span className="chart-graph-legend-dot" style={{ background: POS_COLOR }} /> Lowers risk</span>
        <span className="chart-graph-legend-item"><span className="chart-graph-legend-dot" style={{ background: NEG_COLOR }} /> Raises risk</span>
        <span className="chart-graph-legend-item chart-graph-legend-note">Thicker line = stronger contribution</span>
      </div>
    </div>
  );
}
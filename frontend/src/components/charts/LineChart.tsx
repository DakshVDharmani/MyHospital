import { useId, useState } from 'react';
import './charts.css';

export interface LineChartPoint {
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LineChartPoint[];
  color?: string;
  height?: number;
  unit?: string;
  valueFormatter?: (v: number) => string;
}

const PADDING = { top: 16, right: 12, bottom: 24, left: 34 };
const WIDTH = 560;

/** Rounds a max value up to a "clean" tick step (1/2/5 * 10^n). */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const norm = max / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

export function LineChart({ data, color = '#0E9C8F', height = 200, unit = '', valueFormatter }: LineChartProps) {
  const uid = useId().replace(/[:]/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const fmt = valueFormatter ?? ((v: number) => `${Math.round(v * 10) / 10}${unit}`);

  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const maxVal = niceMax(Math.max(...data.map((d) => d.value), 1));
  const minVal = 0;

  const xFor = (i: number) => PADDING.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const yFor = (v: number) => PADDING.top + innerH - ((v - minVal) / (maxVal - minVal || 1)) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.value)}`).join(' ');
  const areaPath = `${linePath} L ${xFor(data.length - 1)} ${PADDING.top + innerH} L ${xFor(0)} ${PADDING.top + innerH} Z`;

  const gridSteps = 4;
  const gridValues = Array.from({ length: gridSteps + 1 }, (_, i) => (maxVal / gridSteps) * i);

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="chart-line-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="chart-line-svg" role="img" aria-label="Line chart">
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="#DCEBE8"
              strokeWidth={1}
            />
            <text x={PADDING.left - 8} y={yFor(v)} textAnchor="end" dominantBaseline="middle" className="chart-axis-label">
              {Math.round(v)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#area-${uid})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => {
          const isActive = hover === i;
          const isLast = i === data.length - 1;
          return (
            <g key={i}>
              {/* generous invisible hit target, larger than the visible dot */}
              <circle
                cx={xFor(i)}
                cy={yFor(d.value)}
                r={12}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                style={{ cursor: 'pointer' }}
              />
              <circle cx={xFor(i)} cy={yFor(d.value)} r={isActive || isLast ? 5 : 4} fill="#fff" />
              <circle cx={xFor(i)} cy={yFor(d.value)} r={isActive || isLast ? 4 : 3} fill={color} />
            </g>
          );
        })}

        {data.map((d, i) => {
          if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return null;
          return (
            <text key={i} x={xFor(i)} y={height - 6} textAnchor="middle" className="chart-axis-label">
              {d.label}
            </text>
          );
        })}

        {/* direct label on the last point — see marks-and-anatomy: lines label the end */}
        <text
          x={Math.min(xFor(data.length - 1), WIDTH - PADDING.right - 4)}
          y={yFor(data[data.length - 1].value) - 10}
          textAnchor="end"
          className="chart-end-label"
          style={{ fill: '#0B2B3C' }}
        >
          {fmt(data[data.length - 1].value)}
        </text>
      </svg>

      {active && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(xFor(hover!) / WIDTH) * 100}%`,
            top: `${(yFor(active.value) / height) * 100}%`,
          }}
        >
          <span className="chart-tooltip-label">{active.label}</span>
          <span className="chart-tooltip-value">{fmt(active.value)}</span>
        </div>
      )}

      <table className="chart-sr-table">
        <caption>Chart data</caption>
        <thead>
          <tr>
            <th>Label</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{d.label}</td>
              <td>{fmt(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

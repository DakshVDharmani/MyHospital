import { useState, type ReactNode } from 'react';
import './charts.css';

export interface BarChartDatum {
  label: string;
  value: number;
  color: string;
  icon?: ReactNode;
}

export interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
  valueFormatter?: (v: number) => string;
}

const PADDING = { top: 24, right: 12, bottom: 30, left: 12 };
const WIDTH = 420;
const MAX_BAR_THICKNESS = 24;

export function BarChart({ data, height = 200, valueFormatter }: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const fmt = valueFormatter ?? ((v: number) => `${v}`);

  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  const slot = innerW / data.length;
  const barW = Math.min(MAX_BAR_THICKNESS, slot * 0.5);

  return (
    <div className="chart-bar-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="chart-bar-svg" role="img" aria-label="Bar chart">
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={PADDING.top + innerH}
          y2={PADDING.top + innerH}
          stroke="#DCEBE8"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const cx = PADDING.left + slot * i + slot / 2;
          const barH = (d.value / maxVal) * innerH;
          const y = PADDING.top + innerH - barH;
          const isActive = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((h) => (h === i ? null : h))} style={{ cursor: 'pointer' }}>
              <rect x={cx - slot / 2} y={PADDING.top} width={slot} height={innerH} fill="transparent" />
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={Math.max(barH, 2)}
                rx={4}
                fill={d.color}
                opacity={isActive ? 1 : 0.92}
              />
              {/* value at the cap */}
              <text x={cx} y={y - 8} textAnchor="middle" className="chart-end-label" style={{ fill: '#0B2B3C' }}>
                {fmt(d.value)}
              </text>
              <text x={cx} y={height - 8} textAnchor="middle" className="chart-axis-label">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      <table className="chart-sr-table">
        <caption>Chart data</caption>
        <thead>
          <tr>
            <th>Category</th>
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

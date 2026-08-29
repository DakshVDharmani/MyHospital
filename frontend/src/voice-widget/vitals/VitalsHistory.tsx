import React, { useEffect, useMemo, useState } from "react";
import { X, Table2, LineChart as LineChartIcon } from "lucide-react";
import { fetchRecentVitals, type VitalsRow } from "./vitalsApi";

export interface VitalsHistoryProps {
  patientId: string;
  onClose: () => void;
}

interface Point {
  x: number; // day index
  y: number;
  date: string; // short label
}

interface Series {
  label: string;
  color: string;
  points: Point[];
}

// Dark-surface categorical steps from the palette (validated adjacent pairs
// for CVD-safety), picked to sit on this app's teal-navy dark surface.
const BLUE = "#3987e5";
const ORANGE = "#d95926";
const AQUA = "#199e70";
const YELLOW = "#c98500";
const MAGENTA = "#d55181";
const VIOLET = "#9085e9";

function shortDate(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// One row per day: the day's last reading for each metric (check-ins are
// timestamped and already ordered ascending by the fetch).
function toDailySeries(rows: VitalsRow[]) {
  const byDay = new Map<string, VitalsRow>();
  for (const r of rows) byDay.set(r.log_date, r); // later rows overwrite -> last-of-day wins
  const days = Array.from(byDay.keys()).sort();

  const build = (pick: (r: VitalsRow) => number | null, color: string, label: string): Series => ({
    label,
    color,
    points: days
      .map((d, i) => {
        const v = pick(byDay.get(d)!);
        return v == null ? null : { x: i, y: v, date: shortDate(d) };
      })
      .filter((p): p is Point => p !== null),
  });

  return {
    days,
    systolic: build((r) => r.systolic_mmhg, BLUE, "Systolic"),
    diastolic: build((r) => r.diastolic_mmhg, ORANGE, "Diastolic"),
    heartRate: build((r) => r.heart_rate_bpm, AQUA, "Heart rate"),
    temperature: build((r) => r.temperature_c, YELLOW, "Temperature"),
    spo2: build((r) => r.spo2_pct, VIOLET, "SpO2"),
    glucose: build((r) => r.glucose_mgdl, MAGENTA, "Blood sugar"),
  };
}

export function VitalsHistory({ patientId, onClose }: VitalsHistoryProps) {
  const [rows, setRows] = useState<VitalsRow[] | null>(null);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetchRecentVitals(patientId, 15)
      .then(setRows)
      .catch((e) => setError(e.message || "Couldn't load your vitals history."));
  }, [patientId]);

  const daily = useMemo(() => toDailySeries(rows ?? []), [rows]);

  return (
    <div className="vh-overlay" role="dialog" aria-modal="true" aria-label="Vitals history">
      <style>{VITALS_HISTORY_CSS}</style>
      <div className="vh-scrim" onClick={onClose} />

      <div className="vh-panel">
        <div className="vh-header">
          <div>
            <div className="vh-title">My vitals — last 15 days</div>
            <div className="vh-subtitle">Logs older than 15 days are deleted automatically.</div>
          </div>
          <div className="vh-header-actions">
            <button className="vh-toggle" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
              {showTable ? <LineChartIcon size={14} /> : <Table2 size={14} />}
              {showTable ? "Charts" : "Table"}
            </button>
            <button className="vh-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {error && <div className="vh-error">{error}</div>}

        {!error && rows === null && <div className="vh-empty">Loading...</div>}

        {!error && rows !== null && rows.length === 0 && (
          <div className="vh-empty">No check-ins yet — use "Log vitals" to record your first one.</div>
        )}

        {!error && rows !== null && rows.length > 0 && !showTable && (
          <div className="vh-grid">
            <MetricChart title="Blood pressure" unit="mmHg" series={[daily.systolic, daily.diastolic]} />
            <MetricChart title="Heart rate" unit="bpm" series={[daily.heartRate]} />
            <MetricChart title="Temperature" unit="°C" series={[daily.temperature]} />
            <MetricChart title="Oxygen level" unit="%" series={[daily.spo2]} />
            <MetricChart title="Blood sugar" unit="mg/dL" series={[daily.glucose]} />
          </div>
        )}

        {!error && rows !== null && rows.length > 0 && showTable && (
          <div className="vh-table-wrap">
            <table className="vh-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>BP</th>
                  <th>HR</th>
                  <th>Temp</th>
                  <th>SpO2</th>
                  <th>Sugar</th>
                </tr>
              </thead>
              <tbody>
                {daily.days.map((d) => {
                  const r = rows.filter((x) => x.log_date === d).slice(-1)[0];
                  return (
                    <tr key={d}>
                      <td>{shortDate(d)}</td>
                      <td>{r.systolic_mmhg && r.diastolic_mmhg ? `${r.systolic_mmhg}/${r.diastolic_mmhg}` : "—"}</td>
                      <td>{r.heart_rate_bpm ?? "—"}</td>
                      <td>{r.temperature_c ?? "—"}</td>
                      <td>{r.spo2_pct ?? "—"}</td>
                      <td>{r.glucose_mgdl ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricChart({ title, unit, series }: { title: string; unit: string; series: Series[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const active = series.filter((s) => s.points.length > 0);
  const allPoints = active.flatMap((s) => s.points);

  const width = 280;
  const height = 130;
  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 22;

  if (allPoints.length === 0) {
    return (
      <div className="vh-card">
        <div className="vh-card-title">{title}</div>
        <div className="vh-card-empty">No data yet</div>
      </div>
    );
  }

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.15 || Math.max(yMax * 0.1, 1);
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const sx = (x: number) => padL + (xMax === xMin ? 0.5 : (x - xMin) / (xMax - xMin)) * (width - padL - padR);
  const sy = (y: number) => padT + (1 - (y - yLo) / (yHi - yLo || 1)) * (height - padT - padB);

  const gridSteps = 3;
  const gridYs = Array.from({ length: gridSteps }, (_, i) => yLo + ((yHi - yLo) * i) / (gridSteps - 1));

  const hoveredX = hover !== null ? hover : null;

  return (
    <div className="vh-card">
      <div className="vh-card-title">
        {title} <span>({unit})</span>
      </div>
      {active.length > 1 && (
        <div className="vh-legend">
          {active.map((s) => (
            <span key={s.label} className="vh-legend-item">
              <i style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="vh-svg"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          const nearest = allPoints.reduce((best, p) => (Math.abs(sx(p.x) - px) < Math.abs(sx(best.x) - px) ? p : best), allPoints[0]);
          setHover(nearest.x);
        }}
      >
        {gridYs.map((gy, i) => (
          <line key={i} x1={padL} x2={width - padR} y1={sy(gy)} y2={sy(gy)} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        ))}
        {gridYs.map((gy, i) => (
          <text key={i} x={padL - 6} y={sy(gy) + 3} textAnchor="end" fontSize={8} fill="#8FBDB6">
            {Math.round(gy * 10) / 10}
          </text>
        ))}

        {hoveredX !== null && <line x1={sx(hoveredX)} x2={sx(hoveredX)} y1={padT} y2={height - padB} stroke="#0E9C8F" strokeWidth={1} />}

        {active.map((s) => {
          const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ");
          return (
            <g key={s.label}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((p) => (
                <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={p.x === hoveredX ? 5 : 3.5} fill={s.color} stroke="#0B2B3C" strokeWidth={2} />
              ))}
            </g>
          );
        })}

        <text x={padL} y={height - 6} fontSize={8} fill="#8FBDB6">
          {allPoints[0] && shortDate2(active[0]?.points[0]?.date)}
        </text>
        <text x={width - padR} y={height - 6} textAnchor="end" fontSize={8} fill="#8FBDB6">
          {active[0]?.points[active[0].points.length - 1]?.date}
        </text>
      </svg>

      {hoveredX !== null && (
        <div className="vh-tooltip">
          {active.map((s) => {
            const p = s.points.find((pt) => pt.x === hoveredX);
            if (!p) return null;
            return (
              <div key={s.label} className="vh-tooltip-row">
                <i style={{ background: s.color }} /> {active.length > 1 ? `${s.label}: ` : ""}
                {p.y} <span>{p.date}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function shortDate2(d?: string) {
  return d ?? "";
}

const VITALS_HISTORY_CSS = `
.vh-overlay { position: fixed; inset: 0; z-index: 2147483600; display: grid; place-items: center; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif; }
.vh-overlay *, .vh-overlay *::before, .vh-overlay *::after { box-sizing: border-box; }
.vh-scrim { position: absolute; inset: 0; background: rgba(6, 34, 32, 0.72); backdrop-filter: blur(10px) saturate(0.8); -webkit-backdrop-filter: blur(10px) saturate(0.8); }

.vh-panel { position: relative; z-index: 1; width: min(680px, calc(100vw - 32px)); max-height: calc(100vh - 60px); overflow-y: auto; background: #0B2B3C; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; box-shadow: 0 26px 60px rgba(6, 34, 32, 0.5); padding: 20px; }
.vh-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.vh-title { color: #fff; font-size: 16px; font-weight: 800; }
.vh-subtitle { color: #8FBDB6; font-size: 11px; font-weight: 600; margin-top: 3px; }
.vh-header-actions { display: flex; gap: 8px; flex-shrink: 0; }
.vh-toggle { display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.06); color: #EAF7F4; font-size: 11.5px; font-weight: 700; padding: 7px 11px; border-radius: 9px; cursor: pointer; }
.vh-toggle:hover { background: rgba(255, 255, 255, 0.12); }
.vh-close { border: none; background: rgba(255, 255, 255, 0.08); color: #EAF7F4; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; cursor: pointer; }
.vh-close:hover { background: rgba(255, 255, 255, 0.16); }

.vh-empty, .vh-error { color: #B7DAD5; font-size: 13px; font-weight: 600; text-align: center; padding: 40px 10px; }
.vh-error { color: #ffb4af; }

.vh-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.vh-card { background: rgba(255, 255, 255, 0.045); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 12px; position: relative; }
.vh-card-title { color: #fff; font-size: 12.5px; font-weight: 800; margin-bottom: 6px; }
.vh-card-title span { color: #8FBDB6; font-weight: 600; }
.vh-card-empty { color: #8FBDB6; font-size: 12px; font-weight: 600; padding: 30px 0; text-align: center; }
.vh-legend { display: flex; gap: 10px; margin-bottom: 6px; }
.vh-legend-item { display: flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; color: #B7DAD5; }
.vh-legend-item i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.vh-svg { width: 100%; height: auto; cursor: crosshair; }
.vh-tooltip { position: absolute; top: 8px; right: 8px; background: rgba(6, 34, 32, 0.94); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 6px 9px; font-size: 10.5px; font-weight: 700; color: #fff; pointer-events: none; }
.vh-tooltip-row { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.vh-tooltip-row i { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.vh-tooltip-row span { color: #8FBDB6; margin-left: 3px; }

.vh-table-wrap { overflow-x: auto; }
.vh-table { width: 100%; border-collapse: collapse; font-size: 12px; font-weight: 600; color: #EAF7F4; }
.vh-table th { text-align: left; color: #8FBDB6; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; padding: 6px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
.vh-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.07); font-variant-numeric: tabular-nums; }
`;

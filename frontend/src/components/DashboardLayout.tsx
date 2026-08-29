import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  HeartPulse,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  AlertOctagon,
  AlertTriangle,
  Info,
  Check,
  Stethoscope,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { displayDoctorName } from '../lib/formatName';
import { ProfileMenu } from './ProfileMenu';

interface DoctorResult {
  id: string;
  name: string;
  email: string;
}

export interface NavItem {
  label: string;
  icon: ReactNode;
  active?: boolean;
  to?: string;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  time: string;
}

export interface DashboardLayoutProps {
  roleLabel: string;
  name: string;
  eyebrow: string;
  pageTitle: string;
  navItems: NavItem[];
  alerts?: AlertItem[];
  children: ReactNode;
}

const DEFAULT_ALERTS: AlertItem[] = [
  { id: 'a1', severity: 'critical', title: 'Abnormal vital flagged', detail: 'Resting heart rate spike detected overnight.', time: '12m ago' },
  { id: 'a2', severity: 'warning', title: 'Prescription refill due', detail: 'Metformin runs out in 2 days.', time: '1h ago' },
  { id: 'a3', severity: 'info', title: 'New lab report available', detail: 'Complete blood count results are ready to view.', time: '3h ago' },
];

const SEVERITY_META: Record<AlertSeverity, { color: string; bg: string; icon: ReactNode; label: string }> = {
  critical: { color: '#d03b3b', bg: 'rgba(208, 59, 59, 0.12)', icon: <AlertOctagon size={13} />, label: 'Critical' },
  warning: { color: '#b8860b', bg: 'rgba(250, 178, 25, 0.18)', icon: <AlertTriangle size={13} />, label: 'Warning' },
  info: { color: '#2C7FF2', bg: 'rgba(44, 127, 242, 0.12)', icon: <Info size={13} />, label: 'Info' },
};

function AlertsBell({ alerts }: { alerts: AlertItem[] }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  const hasCritical = visible.some((a) => a.severity === 'critical');

  return (
    <div className="dash-alerts" ref={wrapRef}>
      <button
        className={`dash-icon-btn ${open ? 'dash-icon-btn-on' : ''}`}
        aria-label={`Alerts, ${visible.length} unread`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={15} />
        {visible.length > 0 && (
          <span className={`dash-alert-badge ${hasCritical ? 'dash-alert-badge-crit' : ''}`}>
            {visible.length > 9 ? '9+' : visible.length}
          </span>
        )}
      </button>

      {open && (
        <div className="dash-alert-panel" role="menu">
          <div className="dash-alert-panel-head">
            <div>
              <div className="dash-alert-panel-title">Alerts</div>
              <div className="dash-alert-panel-sub">
                {visible.length > 0 ? `${visible.length} need${visible.length === 1 ? 's' : ''} your attention` : 'You are all caught up'}
              </div>
            </div>
            {visible.length > 0 && (
              <button className="dash-alert-clear" onClick={() => setDismissed(new Set(alerts.map((a) => a.id)))}>
                <Check size={12} /> Clear all
              </button>
            )}
          </div>

          <div className="dash-alert-list">
            {visible.length === 0 && (
              <div className="dash-alert-empty">
                <div className="dash-alert-empty-icon"><Check size={18} /></div>
                No active alerts right now.
              </div>
            )}
            {visible.map((a) => {
              const meta = SEVERITY_META[a.severity];
              return (
                <div className="dash-alert-item" key={a.id} style={{ ['--sev' as string]: meta.color }}>
                  <span className="dash-alert-item-icon" style={{ background: meta.bg, color: meta.color }}>
                    {meta.icon}
                  </span>
                  <div className="dash-alert-item-body">
                    <div className="dash-alert-item-top">
                      <span className="dash-alert-item-title">{a.title}</span>
                      <span className="dash-alert-item-time">{a.time}</span>
                    </div>
                    <div className="dash-alert-item-detail">{a.detail}</div>
                  </div>
                  <button
                    className="dash-alert-item-x"
                    aria-label="Dismiss alert"
                    onClick={() => setDismissed((s) => new Set(s).add(a.id))}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Navbar search that queries the `users` table live for doctors matching
 * what's typed. Selecting a result hands the doctor off to the caller
 * (e.g. to route a patient into booking a consultation with them). */
function DoctorSearch({ onSelect }: { onSelect: (doctor: DoctorResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DoctorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // So a doctor searching this box never finds their own profile in it
  // (relevant once this also searches patients — a doctor is never their
  // own patient, but this keeps the exclusion in one place either way).
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(async () => {
      let q = supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'doctor')
        .ilike('name', `%${term}%`);
      if (currentUserId) q = q.neq('id', currentUserId);
      const { data, error } = await q.order('name').limit(6);
      setLoading(false);
      if (!error) setResults(data ?? []);
    }, 260);
    return () => window.clearTimeout(handle);
  }, [query, currentUserId]);

  const showPanel = open && query.trim().length >= 2;

  return (
    <div className="dash-search" ref={wrapRef}>
      <Search size={14} />
      <input
        placeholder="Search doctors by name…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
      />
      <span className="dash-search-kbd">⌘K</span>

      {showPanel && (
        <div className="dash-search-panel" role="listbox">
          {loading && <div className="dash-search-status">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="dash-search-status">No doctors found for &ldquo;{query.trim()}&rdquo;.</div>
          )}
          {!loading &&
            results.map((d) => (
              <button
                key={d.id}
                type="button"
                className="dash-search-item"
                onClick={() => {
                  setOpen(false);
                  setQuery(displayDoctorName(d.name));
                  onSelect(d);
                }}
              >
                <span className="dash-search-item-avatar">
                  <Stethoscope size={13} />
                </span>
                <span className="dash-search-item-text">
                  <span className="dash-search-item-name">{displayDoctorName(d.name)}</span>
                  <span className="dash-search-item-email">{d.email}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export function DashboardLayout({ roleLabel, name, eyebrow, pageTitle, navItems, alerts, children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleDoctorSelect = (_doctor: DoctorResult) => {
    // The only page that does anything with a chosen doctor today is the
    // patient booking flow — a doctor searching the same directory just
    // gets the picked name filled into the box, no navigation.
    if (roleLabel === 'Patient') navigate('/patient/consultation');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="dash-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');

        .dash-shell {
          --teal: #0E9C8F;
          --teal-deep: #0B7A70;
          --navy: #0B2B3C;
          --navy-soft: #4C6B78;
          --ink: #10262E;
          --ink-soft: #5C7680;
          --bg: #F6FAF9;
          --card-bg: #FFFFFF;
          --field-bg: #FFFFFF;
          --line: #D6E8E3;
          --accent: #2C7FF2;
          --danger: #E5544A;
          --ease: cubic-bezier(.22,.61,.36,1);

          /* A fixed (not min-) height so the whole app shell never grows past
             the viewport — sidebar and topbar stay put, and this also gives
             every descendant a real, definite height to resolve percentage
             heights against (a plain min-height here left that undefined,
             which is what let pages like XAI Help's "fill exactly one
             screen" layout render at the wrong size / overflow its card). */
          height: 100vh;
          display: flex;
          overflow: hidden;
          background: var(--bg);
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--ink);
        }
        .dash-shell *, .dash-shell *::before, .dash-shell *::after { box-sizing: border-box; }

        /* ---------------- Sidebar ----------------
           Same background as the rest of the shell — only a border separates
           it, so the whole app reads as one surface instead of colored blocks. */
        .dash-sidebar {
          width: 248px;
          flex-shrink: 0;
          background: var(--bg);
          color: var(--ink);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 10;
        }

        /* Matches the navbar's own height exactly (both are a fixed height,
           not padding-driven, so they can't drift out of sync) and has no
           border of its own — the sidebar's vertical border and the navbar's
           bottom border meet at a single corner instead of a line cutting
           under the logo too. */
        .dash-brand {
          display: flex; align-items: center; gap: 10px;
          height: 69px;
          padding: 0 20px;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .dash-sidebar-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 30px;
          padding: 24px 16px;
          border-right: 1px solid var(--line);
        }
        .dash-brand-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 10px rgba(14, 156, 143, 0.3);
        }
        .dash-brand-name { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 17px; letter-spacing: 0.1px; color: var(--navy); }

        .dash-nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
        .dash-nav-item {
          position: relative;
          display: flex; align-items: center; gap: 11px;
          padding: 10px 12px 10px 14px; border-radius: 11px;
          font-size: 13px; font-weight: 700;
          color: var(--ink-soft);
          cursor: pointer; border: none; background: transparent; text-align: left;
          transition: background 0.2s var(--ease), color 0.2s var(--ease);
        }
        .dash-nav-item:hover { background: var(--field-bg); border: 1px solid var(--line); color: var(--navy); }
        .dash-nav-item:not(.dash-nav-active) { border: 1px solid transparent; }
        .dash-nav-item.dash-nav-active {
          background: rgba(14, 156, 143, 0.1);
          border: 1px solid rgba(14, 156, 143, 0.22);
          color: var(--teal-deep);
        }
        .dash-nav-item.dash-nav-active::before {
          content: '';
          position: absolute;
          left: -16px; top: 50%; transform: translateY(-50%);
          width: 4px; height: 20px; border-radius: 0 4px 4px 0;
          background: var(--teal);
        }
        .dash-nav-item svg { flex-shrink: 0; }

        .dash-sidebar-footer {
          display: flex; flex-direction: column; gap: 10px;
          padding-top: 14px; border-top: 1px solid var(--line);
        }
        .dash-role-pill {
          display: flex; align-items: center; gap: 7px;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase;
          color: var(--ink-soft);
          padding: 0 6px;
        }
        .dash-role-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 0 3px rgba(14,156,143,0.18); flex-shrink: 0; }

        .dash-main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }

        /* ---------------- Topbar / navbar ---------------- */
        .dash-topbar {
          display: flex; align-items: center; justify-content: space-between; gap: 20px;
          height: 69px;
          padding: 0 32px;
          border-bottom: 1px solid var(--line);
          background: var(--bg);
          position: sticky; top: 0; z-index: 5;
          box-sizing: border-box;
        }
        .dash-topbar-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .dash-eyebrow {
          display: flex; align-items: center; gap: 6px;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase;
          color: var(--teal-deep);
        }
        .dash-topbar-title { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 19px; color: var(--navy); line-height: 1.2; }

        .dash-search {
          display: none;
          position: relative;
          align-items: center; gap: 9px;
          background: var(--field-bg); border: 1.5px solid var(--line); border-radius: 999px;
          padding: 9px 14px; min-width: 320px; max-width: 480px; flex: 1;
          color: var(--ink-soft);
          transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background 0.2s var(--ease);
        }
        .dash-search:focus-within {
          border-color: var(--teal);
          box-shadow: 0 0 0 4px rgba(14, 156, 143, 0.12);
          background: #fff;
        }
        .dash-search > svg { flex-shrink: 0; color: #7C9A9A; transition: color 0.2s var(--ease); }
        .dash-search:focus-within > svg { color: var(--teal-deep); }
        .dash-search input { border: none; background: transparent; outline: none; font-size: 13px; font-weight: 600; color: var(--ink); width: 100%; font-family: 'Manrope', sans-serif; }
        .dash-search input::placeholder { color: #9BB0AE; font-weight: 500; }
        .dash-search-kbd {
          flex-shrink: 0;
          font-size: 10px; font-weight: 800; letter-spacing: 0.3px;
          color: #9BB0AE;
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 2px 6px;
        }
        @media (min-width: 980px) { .dash-search { display: flex; } }
        @media (max-width: 1240px) { .dash-search { min-width: 240px; } }

        .dash-search-panel {
          position: absolute; top: calc(100% + 10px); left: 0; right: 0;
          background: var(--card-bg);
          border: 1px solid var(--line);
          border-radius: 14px;
          box-shadow: 0 2px 6px rgba(11, 43, 60, 0.06), 0 22px 48px rgba(6, 34, 32, 0.16);
          z-index: 40;
          overflow: hidden;
          animation: dash-alert-in 0.16s var(--ease);
        }
        .dash-search-status { padding: 14px 16px; font-size: 12px; font-weight: 600; color: var(--ink-soft); }
        .dash-search-item {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border: none; background: transparent; cursor: pointer; text-align: left;
          font-family: inherit;
          transition: background 0.16s var(--ease);
        }
        .dash-search-item:hover, .dash-search-item:focus-visible { background: #F2F8F7; outline: none; }
        .dash-search-item-avatar {
          width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
          background: rgba(14, 156, 143, 0.12); color: var(--teal-deep);
          display: flex; align-items: center; justify-content: center;
        }
        .dash-search-item-text { min-width: 0; display: flex; flex-direction: column; }
        .dash-search-item-name { font-size: 12.5px; font-weight: 800; color: var(--navy); }
        .dash-search-item-email { font-size: 11px; font-weight: 600; color: var(--ink-soft); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .dash-topbar-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .dash-icon-btn {
          position: relative;
          width: 36px; height: 36px; border-radius: 10px;
          border: 1.5px solid var(--line); background: var(--field-bg); color: var(--ink-soft);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: border-color 0.2s var(--ease), color 0.2s var(--ease), box-shadow 0.2s var(--ease);
        }
        .dash-icon-btn:hover { border-color: var(--teal); color: var(--teal-deep); }
        .dash-icon-btn-on { border-color: var(--teal); color: var(--teal-deep); box-shadow: 0 0 0 3px rgba(14,156,143,0.14); }

        /* ---------------- Alerts ---------------- */
        .dash-alerts { position: relative; }
        .dash-alert-badge {
          position: absolute; top: -5px; right: -5px;
          min-width: 16px; height: 16px; padding: 0 4px;
          border-radius: 999px; background: var(--navy); color: #fff;
          font-size: 9.5px; font-weight: 800; line-height: 16px; text-align: center;
          border: 2px solid var(--bg);
        }
        .dash-alert-badge-crit {
          background: var(--danger);
          animation: dash-alert-pulse 1.8s var(--ease) infinite;
        }
        @keyframes dash-alert-pulse {
          0% { box-shadow: 0 0 0 0 rgba(229, 84, 74, 0.5); }
          70% { box-shadow: 0 0 0 7px rgba(229, 84, 74, 0); }
          100% { box-shadow: 0 0 0 0 rgba(229, 84, 74, 0); }
        }

        .dash-alert-panel {
          position: absolute; top: calc(100% + 12px); right: 0;
          width: 340px; max-width: calc(100vw - 32px);
          background: var(--card-bg);
          border: 1px solid var(--line);
          border-radius: 16px;
          box-shadow: 0 2px 6px rgba(11, 43, 60, 0.06), 0 22px 48px rgba(6, 34, 32, 0.16);
          z-index: 40;
          overflow: hidden;
          transform-origin: top right;
          animation: dash-alert-in 0.16s var(--ease);
        }
        @keyframes dash-alert-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dash-alert-panel::before {
          content: '';
          position: absolute; top: -6px; right: 12px;
          width: 12px; height: 12px; background: var(--card-bg);
          border-left: 1px solid var(--line); border-top: 1px solid var(--line);
          transform: rotate(45deg);
        }
        .dash-alert-panel-head {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
          padding: 15px 16px 13px;
          border-bottom: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(14,156,143,0.06), rgba(14,156,143,0));
        }
        .dash-alert-panel-title { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 15px; color: var(--navy); }
        .dash-alert-panel-sub { font-size: 11px; font-weight: 600; color: var(--ink-soft); margin-top: 1px; }
        .dash-alert-clear {
          display: flex; align-items: center; gap: 4px; flex-shrink: 0;
          border: 1px solid var(--line); background: var(--field-bg);
          color: var(--ink-soft); font-family: inherit; font-size: 10.5px; font-weight: 800;
          padding: 5px 9px; border-radius: 8px; cursor: pointer;
          transition: border-color 0.2s var(--ease), color 0.2s var(--ease);
        }
        .dash-alert-clear:hover { border-color: var(--teal); color: var(--teal-deep); }

        .dash-alert-list { max-height: 340px; overflow-y: auto; padding: 6px; }
        .dash-alert-item {
          position: relative;
          display: flex; align-items: flex-start; gap: 11px;
          padding: 12px 12px 12px 14px;
          border-radius: 12px;
          transition: background 0.16s var(--ease);
        }
        .dash-alert-item::before {
          content: ''; position: absolute; left: 5px; top: 12px; bottom: 12px;
          width: 3px; border-radius: 3px; background: var(--sev, var(--teal));
        }
        .dash-alert-item:hover { background: #F2F8F7; }
        .dash-alert-item + .dash-alert-item { margin-top: 2px; }
        .dash-alert-item-icon {
          width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .dash-alert-item-body { min-width: 0; flex: 1; }
        .dash-alert-item-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .dash-alert-item-title { font-size: 12.5px; font-weight: 800; color: var(--navy); }
        .dash-alert-item-time { font-size: 10px; font-weight: 700; color: #9BB0AE; white-space: nowrap; flex-shrink: 0; }
        .dash-alert-item-detail { font-size: 11.5px; font-weight: 500; color: var(--ink-soft); margin-top: 2px; line-height: 1.45; }
        .dash-alert-item-x {
          border: none; background: transparent; color: #9BB0AE; cursor: pointer;
          padding: 2px; border-radius: 6px; flex-shrink: 0; display: flex;
          transition: background 0.16s var(--ease), color 0.16s var(--ease);
        }
        .dash-alert-item-x:hover { background: rgba(229,84,74,0.12); color: var(--danger); }
        .dash-alert-empty {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 30px 20px; text-align: center;
          font-size: 12px; font-weight: 600; color: var(--ink-soft);
        }
        .dash-alert-empty-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: rgba(12,163,12,0.12); color: #0ca30c;
          display: flex; align-items: center; justify-content: center;
        }

        .dash-user-chip { display: flex; align-items: center; gap: 10px; padding-left: 4px; border-left: 1px solid var(--line); }
        .dash-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%);
          color: #fff; font-weight: 800; font-size: 12.5px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 10px rgba(14, 156, 143, 0.32);
        }
        .dash-user-name { font-size: 12.5px; font-weight: 700; color: var(--navy); line-height: 1.3; }
        .dash-user-role { font-size: 10.5px; font-weight: 600; color: var(--ink-soft); }
        .dash-logout {
          display: flex; align-items: center; gap: 6px;
          border: 1.5px solid var(--line); background: var(--field-bg); color: var(--ink-soft);
          padding: 9px 13px; border-radius: 10px; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: border-color 0.2s var(--ease), color 0.2s var(--ease);
        }
        .dash-logout:hover { border-color: var(--danger); color: var(--danger); }

        .dash-mobile-toggle { display: none; border: none; background: transparent; color: var(--navy); cursor: pointer; }

        .dash-content { padding: 30px 32px 56px; flex: 1; min-height: 0; overflow-y: auto; }

        @media (max-width: 900px) {
          .dash-sidebar {
            position: fixed; inset: 0 auto 0 0; z-index: 30;
            transform: translateX(-100%); transition: transform 0.25s var(--ease);
          }
          .dash-sidebar.dash-sidebar-open { transform: translateX(0); }
          .dash-mobile-toggle { display: flex; }
          .dash-topbar { padding: 14px 18px; }
          .dash-content { padding: 20px 16px 44px; }
          .dash-user-name, .dash-user-role { display: none; }
          .dash-user-chip { border-left: none; padding-left: 0; }
        }
      `}</style>

      <aside className={`dash-sidebar ${mobileNavOpen ? 'dash-sidebar-open' : ''}`}>
        <div className="dash-brand">
          <div className="dash-brand-icon"><HeartPulse size={18} strokeWidth={2.3} /></div>
          <span className="dash-brand-name">MyHospital</span>
        </div>

        <div className="dash-sidebar-body">
          <nav className="dash-nav">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`dash-nav-item ${item.active ? 'dash-nav-active' : ''}`}
                onClick={() => {
                  setMobileNavOpen(false);
                  if (item.to && !item.active) navigate(item.to);
                }}
              >
                {item.icon}
                {item.label}
                {item.active && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.8 }} />}
              </button>
            ))}
          </nav>

          <div className="dash-sidebar-footer">
            <div className="dash-role-pill"><span className="dash-role-pill-dot" /> HealthForGood NGO</div>
          </div>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <button className="dash-mobile-toggle" onClick={() => setMobileNavOpen((v) => !v)} aria-label="Toggle navigation">
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <div className="dash-eyebrow">{eyebrow}</div>
              <div className="dash-topbar-title">{pageTitle}</div>
            </div>
          </div>

          <DoctorSearch onSelect={handleDoctorSelect} />

          <div className="dash-topbar-right">
            <AlertsBell alerts={alerts && alerts.length ? alerts : DEFAULT_ALERTS} />
            <ProfileMenu />
            <button className="dash-logout" onClick={handleLogout}>
              <LogOut size={13} /> Log out
            </button>
          </div>
        </header>

        <main className="dash-content">{children}</main>
      </div>
    </div>
  );
}

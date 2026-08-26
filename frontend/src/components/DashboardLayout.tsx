import { useState, type ReactNode } from 'react';
import { HeartPulse, LogOut, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export interface NavItem {
  label: string;
  icon: ReactNode;
  active?: boolean;
}

export interface DashboardLayoutProps {
  roleLabel: string;
  name: string;
  navItems: NavItem[];
  children: ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function DashboardLayout({ roleLabel, name, navItems, children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
          --bg: #F4FAF9;
          --card-bg: #FFFFFF;
          --field-bg: #F2F8F7;
          --line: #DCEBE8;
          --accent: #2C7FF2;
          --danger: #E5544A;
          --ease: cubic-bezier(.22,.61,.36,1);

          min-height: 100vh;
          display: flex;
          background: var(--bg);
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--ink);
        }
        .dash-shell *, .dash-shell *::before, .dash-shell *::after { box-sizing: border-box; }

        .dash-sidebar {
          width: 232px;
          flex-shrink: 0;
          background: linear-gradient(180deg, #0F8F84 0%, #0B6E67 100%);
          color: #fff;
          padding: 26px 18px;
          display: flex;
          flex-direction: column;
          gap: 28px;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        .dash-brand { display: flex; align-items: center; gap: 10px; padding: 0 4px; }
        .dash-brand-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28);
          display: flex; align-items: center; justify-content: center;
        }
        .dash-brand-name { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 17px; }

        .dash-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .dash-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          font-size: 13px; font-weight: 700;
          color: rgba(255,255,255,0.78);
          cursor: pointer; border: none; background: transparent; text-align: left;
          transition: background 0.2s var(--ease), color 0.2s var(--ease);
        }
        .dash-nav-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .dash-nav-item.dash-nav-active { background: rgba(255,255,255,0.16); color: #fff; }
        .dash-nav-item svg { flex-shrink: 0; }

        .dash-sidebar-footer { display: flex; flex-direction: column; gap: 10px; }
        .dash-role-pill {
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase;
          color: rgba(255,255,255,0.7);
          padding: 0 4px;
        }

        .dash-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

        .dash-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 32px; border-bottom: 1px solid var(--line); background: var(--card-bg);
          position: sticky; top: 0; z-index: 5;
        }
        .dash-topbar-title { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 20px; color: var(--navy); }
        .dash-topbar-right { display: flex; align-items: center; gap: 14px; }
        .dash-user-chip { display: flex; align-items: center; gap: 10px; }
        .dash-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: var(--field-bg); border: 1.5px solid var(--line);
          color: var(--teal-deep); font-weight: 800; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .dash-user-name { font-size: 12.5px; font-weight: 700; color: var(--navy); line-height: 1.3; }
        .dash-user-role { font-size: 10.5px; font-weight: 600; color: var(--ink-soft); }
        .dash-logout {
          display: flex; align-items: center; gap: 6px;
          border: 1.5px solid var(--line); background: var(--field-bg); color: var(--ink-soft);
          padding: 8px 12px; border-radius: 9px; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: border-color 0.2s var(--ease), color 0.2s var(--ease);
        }
        .dash-logout:hover { border-color: var(--danger); color: var(--danger); }

        .dash-mobile-toggle { display: none; border: none; background: transparent; color: var(--navy); cursor: pointer; }

        .dash-content { padding: 28px 32px 48px; flex: 1; }

        @media (max-width: 900px) {
          .dash-sidebar {
            position: fixed; inset: 0 auto 0 0; z-index: 30;
            transform: translateX(-100%); transition: transform 0.25s var(--ease);
          }
          .dash-sidebar.dash-sidebar-open { transform: translateX(0); }
          .dash-mobile-toggle { display: flex; }
          .dash-topbar { padding: 16px 18px; }
          .dash-content { padding: 20px 16px 40px; }
          .dash-user-name, .dash-user-role { display: none; }
        }
      `}</style>

      <aside className={`dash-sidebar ${mobileNavOpen ? 'dash-sidebar-open' : ''}`}>
        <div className="dash-brand">
          <div className="dash-brand-icon"><HeartPulse size={18} strokeWidth={2.3} /></div>
          <span className="dash-brand-name">MyHospital</span>
        </div>

        <nav className="dash-nav">
          {navItems.map((item) => (
            <button key={item.label} type="button" className={`dash-nav-item ${item.active ? 'dash-nav-active' : ''}`}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-role-pill">HealthForGood NGO</div>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="dash-mobile-toggle" onClick={() => setMobileNavOpen((v) => !v)} aria-label="Toggle navigation">
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="dash-topbar-title">{roleLabel} Dashboard</div>
          </div>
          <div className="dash-topbar-right">
            <div className="dash-user-chip">
              <div className="dash-avatar">{initials(name)}</div>
              <div>
                <div className="dash-user-name">{name}</div>
                <div className="dash-user-role">{roleLabel}</div>
              </div>
            </div>
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

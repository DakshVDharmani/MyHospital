import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useNotifications, URGENCY_META, type Notification } from '../lib/notifications';

function relTime(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Live notification feed for the topbar. Reads the signed-in user's rows from
 * `public.notifications` (written entirely by DB triggers + the reminder cron)
 * and streams new ones over Supabase Realtime.
 */
export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { items, unreadCount, markRead, markAllRead } = useNotifications(userId);

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

  const hasCritical = items.some((n) => !n.readAt && n.urgency <= 0);

  const onClickItem = (n: Notification) => {
    void markRead(n.notifId);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  return (
    <div className="dash-alerts" ref={wrapRef}>
      <button
        className={`dash-icon-btn ${open ? 'dash-icon-btn-on' : ''}`}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className={`dash-alert-badge ${hasCritical ? 'dash-alert-badge-crit' : ''}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="dash-alert-panel" role="menu">
          <div className="dash-alert-panel-head">
            <div>
              <div className="dash-alert-panel-title">Notifications</div>
              <div className="dash-alert-panel-sub">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </div>
            </div>
            {unreadCount > 0 && (
              <button className="dash-alert-clear" onClick={() => void markAllRead()}>
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="dash-alert-list">
            {items.length === 0 && (
              <div className="dash-alert-empty">
                <div className="dash-alert-empty-icon">
                  <Check size={18} />
                </div>
                Nothing here yet.
              </div>
            )}

            {items.map((n) => {
              const meta = URGENCY_META[n.urgency] ?? URGENCY_META[2];
              return (
                <div
                  className="dash-alert-item"
                  key={n.notifId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onClickItem(n)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClickItem(n)}
                  style={{
                    ['--sev' as string]: meta.color,
                    cursor: n.link ? 'pointer' : 'default',
                    opacity: n.readAt ? 0.6 : 1,
                  }}
                >
                  <span
                    className="dash-alert-item-icon"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    <Bell size={13} />
                  </span>
                  <div className="dash-alert-item-body">
                    <div className="dash-alert-item-top">
                      <span className="dash-alert-item-title">{n.title}</span>
                      <span className="dash-alert-item-time">{relTime(n.createdAt)}</span>
                    </div>
                    <div className="dash-alert-item-detail">{n.message}</div>
                  </div>
                  {!n.readAt && (
                    <button
                      className="dash-alert-item-x"
                      aria-label="Mark read"
                      onClick={(e) => {
                        e.stopPropagation();
                        void markRead(n.notifId);
                      }}
                    >
                      <Check size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

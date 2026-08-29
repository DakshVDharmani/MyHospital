import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Plus, Search, Send, ShieldCheck, X } from 'lucide-react';
import { useProfile } from '../lib/useProfile';
import { useSecureChat } from '../lib/useSecureChat';
import { listPatients } from '../lib/chat';
import './dashboard.css';

function initials(name: string) {
  return name
    .replace(/^Dr\.?\s*/i, '')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function relTime(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function TypingDots({ name }: { name: string }) {
  return (
    <div className="dc-typing">
      <span>{name.split(/\s+/)[0]} is typing</span>
      <span className="dc-typing-dot" />
      <span className="dc-typing-dot" />
      <span className="dc-typing-dot" />
    </div>
  );
}

/**
 * Live, Supabase-backed secure messaging surface. Shared verbatim by the doctor
 * and patient portals — the signed-in user's role decides which side of every
 * thread they see. Delivery + "…typing" + presence all run over Supabase Realtime.
 */
export function SecureChatView() {
  const { id, name, role, loading: profileLoading } = useProfile();
  const me = useMemo(
    () => (id && role ? { id, name: name || 'You', role } : null),
    [id, name, role],
  );

  const {
    threads,
    activeId,
    activeThread,
    setActiveId,
    messages,
    unread,
    peerTyping,
    peerOnline,
    loadingThreads,
    loadingMessages,
    error,
    send,
    notifyTyping,
    startConversationWith,
  } = useSecureChat(me);

  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [picking, setPicking] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => threads.filter((t) => t.peerName.toLowerCase().includes(query.toLowerCase())),
    [threads, query],
  );

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, activeId, peerTyping]);

  useEffect(() => {
    if (picking && role === 'doctor' && patients.length === 0) {
      listPatients().then(setPatients).catch(() => {});
    }
  }, [picking, role, patients.length]);

  const submit = () => {
    if (!input.trim()) return;
    send(input);
    setInput('');
  };

  if (profileLoading) {
    return <div className="dc-page-intro"><p>Loading…</p></div>;
  }
  if (!me) {
    return (
      <div className="dc-page-intro">
        <h1>Secure Chat</h1>
        <p>Please sign in to view your conversations.</p>
      </div>
    );
  }

  return (
    <div className="dc-chat-page">
      {error && (
        <div className="dc-chat-error" role="alert">
          {error}
        </div>
      )}

      <div className="dc-chat">
        <div className="dc-chat-list">
          <div className="dc-chat-list-head">
            <span>Conversations</span>
            {role === 'doctor' ? (
              <button
                className="dc-chat-newbtn"
                onClick={() => setPicking((v) => !v)}
                aria-label="Start a new conversation"
              >
                {picking ? <X size={14} /> : <Plus size={14} />}
              </button>
            ) : (
              <ShieldCheck size={14} />
            )}
          </div>

          {picking && role === 'doctor' && (
            <div className="dc-chat-picker">
              {patients.length === 0 && <div className="dc-chat-picker-empty">No patients found.</div>}
              {patients.map((p) => (
                <button
                  key={p.id}
                  className="dc-chat-picker-row"
                  onClick={() => {
                    startConversationWith(p.id);
                    setPicking(false);
                  }}
                >
                  <span className="dc-chat-person-av">{initials(p.name)}</span>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '10px 12px', borderBottom: '1px solid #EEF4F3' }}>
            <div className="dash-search" style={{ display: 'flex', minWidth: 0, width: '100%' }}>
              <Search size={13} />
              <input
                placeholder="Search people…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {loadingThreads && <div className="dc-chat-picker-empty">Loading conversations…</div>}
          {!loadingThreads && filtered.length === 0 && (
            <div className="dc-chat-picker-empty">
              {role === 'doctor' ? 'No conversations yet — start one with “+”.' : 'No conversations yet.'}
            </div>
          )}

          {filtered.map((t) => (
            <button
              key={t.id}
              className={`dc-chat-person ${t.id === activeId ? 'dc-chat-on' : ''}`}
              onClick={() => setActiveId(t.id)}
            >
              <span className="dc-chat-person-av">{initials(t.peerName)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="dc-chat-person-name">{t.peerName}</div>
                <div className="dc-chat-person-last">
                  {t.lastPreview || t.subject || (t.peerRole === 'doctor' ? 'Doctor' : 'Patient')}
                </div>
              </div>
              <div className="dc-chat-person-meta">
                <span className="dc-chat-person-time">{relTime(t.lastMessageAt)}</span>
                {unread[t.id] ? <span className="dc-chat-unread">{unread[t.id]}</span> : null}
              </div>
            </button>
          ))}
        </div>

        <div className="dc-chat-main">
          {activeThread ? (
            <>
              <div className="dc-chat-main-head">
                <span className="dc-chat-person-av">{initials(activeThread.peerName)}</span>
                <div>
                  <div className="dc-chat-person-name">{activeThread.peerName}</div>
                  <div className="dc-chat-person-last" style={{ maxWidth: 'none' }}>
                    {peerOnline ? (
                      <span className="dc-chat-presence dc-chat-presence-on">● Online</span>
                    ) : (
                      <span className="dc-chat-presence">● Offline</span>
                    )}
                  </div>
                </div>
                <span className="dc-chat-enc">
                  <Lock size={11} /> RLS-secured
                </span>
              </div>

              <div className="dc-chat-body" ref={bodyRef}>
                {loadingMessages && <span className="dc-chat-day">Loading…</span>}
                {!loadingMessages && messages.length === 0 && (
                  <span className="dc-chat-day">No messages yet — say hello</span>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`dc-msg ${m.senderId === me.id ? 'dc-msg-out' : 'dc-msg-in'} ${
                      m.pending ? 'dc-msg-pending' : ''
                    }`}
                  >
                    {m.content}
                    <span className="dc-msg-time">
                      {m.pending ? 'sending…' : clockTime(m.createdAt)}
                    </span>
                  </div>
                ))}
                {peerTyping && <TypingDots name={activeThread.peerName} />}
              </div>

              <div className="dc-chat-compose">
                <input
                  placeholder="Write a secure message…"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    notifyTyping();
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
                <button className="dc-chat-send" onClick={submit} aria-label="Send message">
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="dc-chat-body">
              <span className="dc-chat-day">Select a conversation</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

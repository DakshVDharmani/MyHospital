import { useMemo, useRef, useState, useEffect } from 'react';
import { Lock, Search, Send, ShieldCheck } from 'lucide-react';
import './dashboard.css';

interface ChatMessage {
  id: number;
  from: 'me' | 'them';
  text: string;
  time: string;
}

export interface ChatThread {
  id: string;
  name: string;
  role: string;
  last: string;
  time: string;
  unread?: number;
  messages: ChatMessage[];
}

function initials(name: string) {
  return name.replace(/^Dr\.?\s*/i, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

/** End-to-end-styled messaging surface reused by both the patient and the
 * clinician portals. Fully client-side / illustrative — no network. */
export function SecureChatView({ threads }: { threads: ChatThread[] }) {
  const [activeId, setActiveId] = useState(threads[0]?.id);
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => threads.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())),
    [threads, query]
  );
  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  const messages = active ? [...active.messages, ...(drafts[active.id] ?? [])] : [];

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, activeId]);

  const send = () => {
    if (!input.trim() || !active) return;
    const msg: ChatMessage = {
      id: Date.now(),
      from: 'me',
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };
    setDrafts((d) => ({ ...d, [active.id]: [...(d[active.id] ?? []), msg] }));
    setInput('');
  };

  return (
    <>
      <div className="dc-page-intro">
        <h1>Secure Chat</h1>
        <p>Every conversation is end-to-end encrypted and access-logged for compliance. Messages are retained per your care network's data-retention policy.</p>
      </div>

      <div className="dc-chat">
        <div className="dc-chat-list">
          <div className="dc-chat-list-head">
            <span>Conversations</span>
            <ShieldCheck size={14} />
          </div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #EEF4F3' }}>
            <div className="dash-search" style={{ display: 'flex', minWidth: 0, width: '100%' }}>
              <Search size={13} />
              <input placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          {filtered.map((t) => (
            <button
              key={t.id}
              className={`dc-chat-person ${t.id === active?.id ? 'dc-chat-on' : ''}`}
              onClick={() => setActiveId(t.id)}
            >
              <span className="dc-chat-person-av">{initials(t.name)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="dc-chat-person-name">{t.name}</div>
                <div className="dc-chat-person-last">{t.last}</div>
              </div>
              <div className="dc-chat-person-meta">
                <span className="dc-chat-person-time">{t.time}</span>
                {t.unread ? <span className="dc-chat-unread">{t.unread}</span> : null}
              </div>
            </button>
          ))}
        </div>

        <div className="dc-chat-main">
          {active && (
            <>
              <div className="dc-chat-main-head">
                <span className="dc-chat-person-av">{initials(active.name)}</span>
                <div>
                  <div className="dc-chat-person-name">{active.name}</div>
                  <div className="dc-chat-person-last" style={{ maxWidth: 'none' }}>{active.role}</div>
                </div>
                <span className="dc-chat-enc"><Lock size={11} /> Encrypted</span>
              </div>

              <div className="dc-chat-body" ref={bodyRef}>
                <span className="dc-chat-day">Today</span>
                {messages.map((m) => (
                  <div key={m.id} className={`dc-msg ${m.from === 'me' ? 'dc-msg-out' : 'dc-msg-in'}`}>
                    {m.text}
                    <span className="dc-msg-time">{m.time}</span>
                  </div>
                ))}
              </div>

              <div className="dc-chat-compose">
                <input
                  placeholder="Write a secure message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <button className="dc-chat-send" onClick={send} aria-label="Send message">
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

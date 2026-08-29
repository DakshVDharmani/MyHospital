import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import {
  decryptMessage,
  ensureConversation,
  listMessages,
  listThreads,
  mapMessage,
  markThreadRead,
  sendMessage,
  type Message,
  type Thread,
} from './chat';

interface Me {
  id: string;
  name: string;
  role: 'doctor' | 'patient';
}

const TYPING_STOP_MS = 1800; // silence after which we tell the peer we stopped
const TYPING_CLEAR_MS = 4000; // safety: drop the peer's indicator if no "stop" arrives

/**
 * Live secure-chat state for one signed-in user, backed entirely by Supabase:
 *   - message history + inserts/edits via Postgres Changes (RLS-scoped)
 *   - "…typing" via Realtime Broadcast (ephemeral, never touches the DB)
 *   - online state via Realtime Presence
 */
export function useSecureChat(me: Me | null) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const convChannelRef = useRef<RealtimeChannel | null>(null);
  const sendTypingStopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearPeerTypingRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTypingRef = useRef(false);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );

  /* ---------------- initial thread list ---------------- */
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    setLoadingThreads(true);
    listThreads(me.id, me.role)
      .then((rows) => {
        if (cancelled) return;
        setThreads(rows);
        setActiveId((cur) => cur ?? rows[0]?.id ?? null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingThreads(false));
    return () => {
      cancelled = true;
    };
  }, [me]);

  /* ---------------- inbox: every new message I'm allowed to see ---------------- */
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel('sc:inbox')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async ({ new: row }) => {
          const m = await decryptMessage(mapMessage(row as never));
          setThreads((prev) => {
            const i = prev.findIndex((t) => t.id === m.conversationId);
            if (i === -1) {
              // a brand-new conversation for me — refetch to pick up peer info
              listThreads(me.id, me.role).then(setThreads).catch(() => {});
              return prev;
            }
            const next = [...prev];
            next[i] = { ...next[i], lastMessageAt: m.createdAt, lastPreview: m.content };
            next.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
            return next;
          });

          if (m.conversationId === activeIdRef.current) {
            setMessages((prev) => mergeMessage(prev, m));
            if (m.senderId !== me.id) setPeerTyping(false);
          } else if (m.senderId !== me.id) {
            setUnread((u) => ({ ...u, [m.conversationId]: (u[m.conversationId] ?? 0) + 1 }));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me]);

  /* ---------------- active conversation: history + typing + presence ---------------- */
  useEffect(() => {
    if (!me || !activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setPeerTyping(false);
    setPeerOnline(false);

    listMessages(activeId)
      .then((rows) => !cancelled && setMessages(rows))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingMessages(false));

    setUnread((u) => ({ ...u, [activeId]: 0 }));
    markThreadRead(activeId, me.id).catch(() => {});

    const channel = supabase.channel(`sc:conv:${activeId}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId === me.id) return;
        setPeerTyping(true);
        clearTimeout(clearPeerTypingRef.current);
        clearPeerTypingRef.current = setTimeout(() => setPeerTyping(false), TYPING_CLEAR_MS);
      })
      .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
        if (payload?.userId !== me.id) setPeerTyping(false);
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` },
        async ({ new: row }) => {
          const m = await decryptMessage(mapMessage(row as never));
          setMessages((prev) =>
            m.deletedAt
              ? prev.filter((x) => x.id !== m.id)
              : prev.map((x) => (x.id === m.id ? m : x)),
          );
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const peers = Object.keys(state).filter((k) => k !== me.id);
        setPeerOnline(peers.length > 0);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ online_at: new Date().toISOString(), role: me.role });
        }
      });

    convChannelRef.current = channel;
    return () => {
      cancelled = true;
      clearTimeout(sendTypingStopRef.current);
      clearTimeout(clearPeerTypingRef.current);
      isTypingRef.current = false;
      supabase.removeChannel(channel);
      convChannelRef.current = null;
    };
  }, [me, activeId]);

  /* ---------------- actions ---------------- */

  /** Call on every keystroke in the composer. */
  const notifyTyping = useCallback(() => {
    const ch = convChannelRef.current;
    if (!ch || !me) return;
    ch.send({ type: 'broadcast', event: 'typing', payload: { userId: me.id, name: me.name } });
    isTypingRef.current = true;
    clearTimeout(sendTypingStopRef.current);
    sendTypingStopRef.current = setTimeout(() => {
      isTypingRef.current = false;
      ch.send({ type: 'broadcast', event: 'stop_typing', payload: { userId: me.id } });
    }, TYPING_STOP_MS);
  }, [me]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !me || !activeId) return;

      const clientGeneratedId = crypto.randomUUID();
      const optimistic: Message = {
        id: `pending:${clientGeneratedId}`,
        conversationId: activeId,
        senderId: me.id,
        senderRole: me.role,
        messageType: 'text',
        content: body,
        clientGeneratedId,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      // stop the typing indicator immediately on send
      clearTimeout(sendTypingStopRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        convChannelRef.current?.send({
          type: 'broadcast',
          event: 'stop_typing',
          payload: { userId: me.id },
        });
      }

      try {
        const saved = await sendMessage({
          conversationId: activeId,
          senderId: me.id,
          senderRole: me.role,
          content: body,
          clientGeneratedId,
        });
        setMessages((prev) => mergeMessage(prev, saved));
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.clientGeneratedId !== clientGeneratedId));
        setError(e instanceof Error ? e.message : 'Failed to send');
      }
    },
    [me, activeId],
  );

  /** Doctor-only: open (creating if needed) a thread with a patient. */
  const startConversationWith = useCallback(
    async (patientId: string) => {
      if (!me || me.role !== 'doctor') return;
      try {
        const id = await ensureConversation(me.id, patientId);
        const rows = await listThreads(me.id, me.role);
        setThreads(rows);
        setActiveId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start conversation');
      }
    },
    [me],
  );

  return {
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
  };
}

/** Insert-or-replace a message, reconciling the optimistic copy by clientGeneratedId. */
function mergeMessage(list: Message[], m: Message): Message[] {
  const byId = list.some((x) => x.id === m.id);
  if (byId) return list.map((x) => (x.id === m.id ? { ...m } : x));
  const optimisticIdx = list.findIndex((x) => x.clientGeneratedId === m.clientGeneratedId);
  if (optimisticIdx !== -1) {
    const next = [...list];
    next[optimisticIdx] = m;
    return next;
  }
  return [...list, m];
}

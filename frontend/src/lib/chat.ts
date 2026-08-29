import { supabase } from './supabaseClient';
import { decryptText, encryptText } from './crypto';

/** A row from `public.messages`, as returned to the client. */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'doctor' | 'patient';
  messageType: 'text' | 'image' | 'file' | 'system';
  content: string;
  clientGeneratedId: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  /** True while an optimistic message is still being persisted. */
  pending?: boolean;
}

/** A conversation plus the *other* participant, ready for the thread list. */
export interface Thread {
  id: string;
  status: 'active' | 'closed' | 'archived';
  subject: string | null;
  lastMessageAt: string | null;
  /** The person on the other side of this thread (not the signed-in user). */
  peerId: string;
  peerName: string;
  peerRole: 'doctor' | 'patient';
  lastPreview: string;
}

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: 'doctor' | 'patient';
  message_type: Message['messageType'];
  content: string;
  client_generated_id: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

/** Maps a raw row to a Message. `content` is still the stored (encrypted) value —
 * call {@link decryptMessage} to get the readable body. */
export function mapMessage(r: MessageRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderRole: r.sender_role,
    messageType: r.message_type,
    content: r.content,
    clientGeneratedId: r.client_generated_id,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deletedAt: r.deleted_at,
  };
}

/**
 * Loads every conversation the signed-in user belongs to (RLS already limits
 * the rows to theirs), newest activity first, with the other participant's
 * name resolved via the two FKs into `public.users`.
 */
export async function listThreads(
  myId: string,
  myRole: 'doctor' | 'patient',
): Promise<Thread[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `id, status, subject, last_message_at,
       doctor:users!conversations_doctor_id_fkey ( id, name, role ),
       patient:users!conversations_patient_id_fkey ( id, name, role )`,
    )
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    status: Thread['status'];
    subject: string | null;
    last_message_at: string | null;
    doctor: { id: string; name: string; role: 'doctor' | 'patient' } | null;
    patient: { id: string; name: string; role: 'doctor' | 'patient' } | null;
  }>;

  return rows.map((row) => {
    const peer = myRole === 'doctor' ? row.patient : row.doctor;
    return {
      id: row.id,
      status: row.status,
      subject: row.subject,
      lastMessageAt: row.last_message_at,
      peerId: peer?.id ?? '',
      peerName: peer?.name ?? 'Unknown',
      peerRole: peer?.role ?? (myRole === 'doctor' ? 'patient' : 'doctor'),
      lastPreview: '',
    };
  });
}

/** Returns the message with its body decrypted for display. */
export async function decryptMessage(m: Message): Promise<Message> {
  return { ...m, content: await decryptText(m.content) };
}

/** Full message history for one conversation, oldest first. Skips soft-deleted rows. */
export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Promise.all((data as MessageRow[]).map((r) => decryptMessage(mapMessage(r))));
}

/**
 * Inserts a message. `clientGeneratedId` makes the write idempotent (there is a
 * unique index on `(conversation_id, client_generated_id)`), so a retry after a
 * flaky network will not double-post.
 */
export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  senderRole: 'doctor' | 'patient';
  content: string;
  clientGeneratedId: string;
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      sender_role: input.senderRole,
      content: await encryptText(input.content),
      client_generated_id: input.clientGeneratedId,
    })
    .select('*')
    .single();
  if (error) throw error;
  // return the row with the plaintext we already hold, no decrypt round-trip
  return { ...mapMessage(data as MessageRow), content: input.content };
}

/** Patients a doctor can start a new thread with. */
export async function listPatients(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'patient')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/**
 * Returns the existing doctor↔patient thread or creates one. The unique
 * `(doctor_id, patient_id)` index means the upsert is race-safe.
 */
export async function ensureConversation(
  doctorId: string,
  patientId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('patient_id', patientId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ doctor_id: doctorId, patient_id: patientId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Marks the other party's messages in a thread as read for the signed-in user. */
export async function markThreadRead(conversationId: string, myId: string): Promise<void> {
  const { data: unread } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .neq('sender_id', myId)
    .is('deleted_at', null);
  if (!unread?.length) return;

  await supabase.from('message_receipts').upsert(
    unread.map((m) => ({ message_id: m.id, user_id: myId, read_at: new Date().toISOString() })),
    { onConflict: 'message_id,user_id' },
  );
}

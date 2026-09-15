export interface XaiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Asks the "Ask your care team" assistant a question, grounded only in the
 * patient-record context the caller supplies (see patientContext.ts). */
export async function askXaiAssistant(
  backendUrl: string,
  question: string,
  context: string,
  history: XaiChatMessage[]
): Promise<string> {
  const res = await fetch(`${backendUrl.replace(/\/$/, '')}/api/xai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context, history }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Assistant request failed (${res.status})`);
  return data.reply as string;
}

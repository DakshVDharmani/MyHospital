/**
 * Symmetric envelope for secure-chat message bodies.
 *
 * AES-256-GCM via the Web Crypto API. Ciphertext is what lands in
 * `public.messages.content` (and, later, the MongoDB mirror), so a database
 * dump / dashboard view / backup never contains the readable message.
 *
 * Scope of protection: this keeps plaintext out of at-rest storage. The key is
 * bundled into the client (Vite inlines `VITE_` vars), so it is NOT end-to-end
 * encryption — a determined signed-in user can recover the key from the shipped
 * JS. For real E2EE you would move to per-user keypairs.
 *
 * Stored format:  enc.v1.<base64(iv)>.<base64(ciphertext+tag)>
 * Rows without the `enc.v1.` prefix are treated as legacy plaintext and passed
 * through unchanged, so this can be turned on without a data migration.
 */

const KEY_B64 = import.meta.env.VITE_CHAT_ENC_KEY as string | undefined;
const PREFIX = 'enc.v1.';

let keyPromise: Promise<CryptoKey> | null = null;

function toBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function getKey(): Promise<CryptoKey> {
  if (!KEY_B64) {
    throw new Error(
      'Missing VITE_CHAT_ENC_KEY. Generate one and add it to MyHospital/frontend/.env:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      toBytes(KEY_B64),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
  }
  return keyPromise;
}

/** True once a key is configured — lets callers keep working before the env var is set. */
export const encryptionEnabled = Boolean(KEY_B64);

export async function encryptText(plain: string): Promise<string> {
  if (!encryptionEnabled) return plain;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${PREFIX}${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptText(stored: string): Promise<string> {
  if (!stored || !stored.startsWith(PREFIX)) return stored; // legacy plaintext row
  try {
    const key = await getKey();
    const [, , ivB64, ctB64] = stored.split('.');
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toBytes(ivB64) },
      key,
      toBytes(ctB64),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return '[unable to decrypt]';
  }
}

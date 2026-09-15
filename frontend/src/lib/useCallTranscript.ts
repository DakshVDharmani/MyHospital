import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================================
 *  useCallTranscript — live speech-to-text for a video consultation.
 *
 *  Two capture modes:
 *   - Backend mode (preferred, used whenever a backend URL + the call's own
 *     local media stream are available): re-records the SAME microphone track
 *     the WebRTC call already has permission for, in short chunks, and sends
 *     each chunk to the backend's /api/stt route (Groq Whisper — see
 *     backend/routes/stt.js). Works in every modern browser and doesn't
 *     depend on Google's speech servers being reachable.
 *   - Browser mode (fallback, no backend configured): uses the native
 *     SpeechRecognition API (Chrome/Edge only). Requests its own microphone
 *     access independently of the call.
 *
 *  Each participant's browser transcribes *their own* microphone, so every
 *  line is tagged with the local speaker's name; the doctor's device is the
 *  one that persists the record when the call ends.
 * ==========================================================================*/

export interface TranscriptLine {
  /** epoch ms */
  at: number;
  /** "HH:MM" local */
  clock: string;
  speaker: string;
  text: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getSR(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const hasMediaRecorder = () => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

const clockOf = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

// How much audio to batch per backend STT request.
const CHUNK_MS = 6000;
// Chunks smaller than this are near-silence — skip the round trip.
const MIN_CHUNK_BYTES = 3000;

export interface CallTranscript {
  supported: boolean;
  capturing: boolean;
  /** finalised lines, in order */
  lines: TranscriptLine[];
  /** the not-yet-finalised phrase currently being spoken (for a live caption) */
  interim: string;
  /** permission / engine error, if any */
  error: string | null;
  /** pass the call's local MediaStream so backend mode can reuse its mic track */
  start: (stream?: MediaStream | null) => void;
  stop: () => void;
  /** the whole meeting as plain text — "HH:MM  Speaker: line" */
  toPlainText: (header?: string) => string;
}

export function useCallTranscript(speaker: string, backendUrl?: string): CallTranscript {
  const [supported] = useState<boolean>(() => !!getSR() || hasMediaRecorder());
  const [capturing, setCapturing] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const wantRef = useRef(false);
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const backendRef = useRef(backendUrl);
  backendRef.current = backendUrl;

  const addLine = useCallback((text: string) => {
    const at = Date.now();
    setLines((prev) => [...prev, { at, clock: clockOf(at), speaker: speakerRef.current, text }]);
  }, []);

  // ---- Backend mode: chunked MediaRecorder + /api/stt --------------------
  const startBackendLoop = useCallback(
    (stream: MediaStream, backend: string) => {
      const audioStream = new MediaStream(stream.getAudioTracks());
      if (audioStream.getAudioTracks().length === 0) {
        setError('No microphone audio is available to transcribe this call.');
        wantRef.current = false;
        setCapturing(false);
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

      const recordChunk = () => {
        if (!wantRef.current) return;
        let rec: MediaRecorder;
        try {
          rec = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
        } catch (err: any) {
          setError(err?.message || 'Could not start recording this call for transcription.');
          wantRef.current = false;
          setCapturing(false);
          return;
        }
        const parts: BlobPart[] = [];
        rec.ondataavailable = (e: BlobEvent) => {
          if (e.data.size > 0) parts.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(parts, { type: rec.mimeType || 'audio/webm' });
          // Keep the loop going immediately — don't block the next chunk on
          // this one's transcription round trip.
          if (wantRef.current) recordChunk();
          else setCapturing(false);

          if (blob.size < MIN_CHUNK_BYTES) return;
          (async () => {
            try {
              const form = new FormData();
              form.append('file', blob, 'chunk.webm');
              const res = await fetch(`${backend}/api/stt`, { method: 'POST', body: form });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || `STT failed (${res.status})`);
              const text = (data.transcript || '').trim();
              if (text) {
                addLine(text);
                setError(null);
              }
            } catch (err: any) {
              console.warn('call transcript chunk failed:', err);
              setError('Transcription had a hiccup reaching the backend — some lines may be missing.');
            }
          })();
        };
        mediaRecRef.current = rec;
        rec.start();
        setTimeout(() => {
          if (rec.state !== 'inactive') rec.stop();
        }, CHUNK_MS);
      };

      recordChunk();
    },
    [addLine],
  );

  // ---- Browser mode: native SpeechRecognition -----------------------------
  const startBrowserLoop = useCallback(() => {
    const SR = getSR();
    if (!SR) return false;

    const spin = () => {
      if (!wantRef.current) return;
      const rec = new SR();
      rec.lang = navigator.language || 'en-US';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (e: any) => {
        let live = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const txt = (res[0]?.transcript ?? '').trim();
          if (!txt) continue;
          if (res.isFinal) addLine(txt);
          else live += txt + ' ';
        }
        setInterim(live.trim());
      };

      rec.onerror = (e: any) => {
        const err = e?.error;
        if (err === 'no-speech' || err === 'aborted') return;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setError('Microphone permission is needed to record the visit transcript.');
          wantRef.current = false;
          setCapturing(false);
        } else if (err === 'network') {
          setError(
            'Speech recognition could not reach the browser vendor’s speech servers. Set VITE_VOICE_BACKEND_URL to transcribe via the backend instead.',
          );
          wantRef.current = false;
          setCapturing(false);
        }
      };

      rec.onend = () => {
        recRef.current = null;
        setInterim('');
        // Chrome auto-stops periodically — respin while the call is live.
        if (wantRef.current) setTimeout(spin, 250);
        else setCapturing(false);
      };

      recRef.current = rec;
      try {
        rec.start();
      } catch {
        /* start() throws if called too soon after a previous stop — the
           onend respin covers it */
      }
    };

    spin();
    return true;
  }, [addLine]);

  const start = useCallback(
    (stream?: MediaStream | null) => {
      if (wantRef.current) return;
      wantRef.current = true;
      setError(null);
      setCapturing(true);

      const backend = backendRef.current;
      if (backend && stream && hasMediaRecorder()) {
        startBackendLoop(stream, backend);
        return;
      }

      if (startBrowserLoop()) return;

      wantRef.current = false;
      setCapturing(false);
      setError(
        backend
          ? 'No microphone audio is available yet to transcribe this call.'
          : 'This browser can’t transcribe speech locally (try Chrome/Edge), and no transcription backend is configured.',
      );
    },
    [startBackendLoop, startBrowserLoop],
  );

  const stop = useCallback(() => {
    wantRef.current = false;
    setCapturing(false);
    setInterim('');
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* ignore */
    }
    const mrec = mediaRecRef.current;
    mediaRecRef.current = null;
    try {
      if (mrec && mrec.state !== 'inactive') mrec.stop();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const toPlainText = useCallback(
    (header?: string) => {
      const body = lines.map((l) => `${l.clock}  ${l.speaker}: ${l.text}`).join('\n');
      return header ? `${header}\n\n${body}\n` : `${body}\n`;
    },
    [lines],
  );

  return { supported, capturing, lines, interim, error, start, stop, toPlainText };
}

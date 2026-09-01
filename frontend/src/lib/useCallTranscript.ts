import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================================
 *  useCallTranscript — live speech-to-text for a video consultation.
 *
 *  Uses the browser Web Speech API (Chrome / Edge). Each participant's browser
 *  transcribes *their own* microphone, so every line is tagged with the local
 *  speaker's name; the doctor's device is the one that persists the record when
 *  the call ends. Chrome ends a recognition session roughly every ~60s, so we
 *  transparently restart it while the call is live.
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

const clockOf = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export interface CallTranscript {
  supported: boolean;
  capturing: boolean;
  /** finalised lines, in order */
  lines: TranscriptLine[];
  /** the not-yet-finalised phrase currently being spoken (for a live caption) */
  interim: string;
  /** permission / engine error, if any */
  error: string | null;
  start: () => void;
  stop: () => void;
  /** the whole meeting as plain text — "HH:MM  Speaker: line" */
  toPlainText: (header?: string) => string;
}

export function useCallTranscript(speaker: string): CallTranscript {
  const [supported] = useState<boolean>(() => !!getSR());
  const [capturing, setCapturing] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR || wantRef.current) return;
    wantRef.current = true;
    setError(null);
    setCapturing(true);

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
          if (res.isFinal) {
            const at = Date.now();
            setLines((prev) => [
              ...prev,
              { at, clock: clockOf(at), speaker: speakerRef.current, text: txt },
            ]);
          } else {
            live += txt + ' ';
          }
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
          setError('Speech recognition lost its network connection; the transcript may have gaps.');
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
  }, []);

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

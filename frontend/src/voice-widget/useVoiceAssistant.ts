// Self-contained copy of VoiceAsst's assistant hook, kept local to this
// widget so LoginPages doesn't need a cross-package/workspace link into
// ../VoiceAsst (that project's folder structure is left untouched).
import { useCallback, useEffect, useRef, useState } from "react";
import { findWebVoice, LANGUAGES, findLang, detectLangFromText, detectInitialLang } from "./languages";

export type AssistantStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface VoiceAssistantOptions {
  backendUrl?: string;
  defaultLang?: string;
  useSarvamVoice?: boolean;
  useSarvamStt?: boolean;
  autoSpeak?: boolean;
  onTranscript?: (t: string) => void;
  onReply?: (r: string) => void;
  onStatusChange?: (s: AssistantStatus) => void;
}

const MAX_RECORD_MS = 15000;

export function useVoiceAssistant(opts: VoiceAssistantOptions = {}) {
  const {
    backendUrl = "",
    defaultLang = detectInitialLang(),
    useSarvamVoice = true,
    useSarvamStt = true,
    autoSpeak = true,
    onTranscript,
    onReply,
    onStatusChange,
  } = opts;

  const [lang, setLang] = useState<string>(defaultLang);
  const [autoLang, setAutoLang] = useState(true); // true until the user manually picks a language
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);

  const langRef = useRef(lang);
  const autoLangRef = useRef(autoLang);
  const statusRef = useRef(status);
  const backendRef = useRef(backendUrl);
  const optsRef = useRef({ useSarvamVoice, useSarvamStt, autoSpeak });
  const recRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const maxRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  const setSafeStatus = (s: AssistantStatus) => {
    statusRef.current = s;
    setStatus(s);
    onStatusChange?.(s);
  };

  langRef.current = lang;
  autoLangRef.current = autoLang;
  backendRef.current = backendUrl;
  optsRef.current = { useSarvamVoice, useSarvamStt, autoSpeak };

  const speakWithWeb = useCallback((text: string, langCode: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = findWebVoice(findLang(langCode));
    if (voice) u.voice = voice;
    u.lang = findLang(langCode).webCode;
    u.onstart = () => setSafeStatus("speaking");
    u.onend = () => setSafeStatus("idle");
    u.onerror = () => setSafeStatus("idle");
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    async (text: string, langCode: string) => {
      const { useSarvamVoice, autoSpeak } = optsRef.current;
      if (!autoSpeak) return;
      const backend = backendRef.current;
      if (backend && useSarvamVoice) {
        try {
          const res = await fetch(`${backend}/api/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, lang: langCode }),
          });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            setSafeStatus("speaking");
            audio.onended = () => {
              setSafeStatus("idle");
              URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
              setSafeStatus("idle");
              speakWithWeb(text, langCode);
            };
            await audio.play();
            return;
          } else {
            const errBody = await res.json().catch(() => ({}));
            console.warn("Sarvam TTS failed, falling back to browser voice:", errBody.error || res.status);
          }
        } catch (e) {
          console.warn("Sarvam TTS request failed, falling back to browser voice:", e);
        }
      }
      speakWithWeb(text, langCode);
    },
    [speakWithWeb]
  );

  const sendToAssistant = useCallback(
    async (message: string, optsOverride?: { lang?: string }) => {
      // Auto-detect the language from what the user actually said/typed, so
      // they never have to pick one themselves. A manual pick (autoLang
      // false) is left alone.
      if (!optsOverride?.lang && autoLangRef.current) {
        const detected = detectLangFromText(message);
        if (detected && detected !== langRef.current) {
          langRef.current = detected;
          setLang(detected);
        }
      }
      const code = optsOverride?.lang || langRef.current;
      const backend = backendRef.current;
      setTranscript(message);
      onTranscript?.(message);

      if (!backend) {
        const text = fallbackReply(message, code);
        setReply(text);
        onReply?.(text);
        speak(text, code);
        return;
      }

      try {
        const res = await fetch(`${backend}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            lang: code,
            history: historyRef.current,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Chat failed");
        const text = (data.reply || "").trim();
        if (!text) {
          setError("The assistant didn't return a reply. Try again.");
          setSafeStatus("error");
          return;
        }
        historyRef.current = [...historyRef.current, { role: "user", content: message }, { role: "assistant", content: text }];
        setReply(text);
        onReply?.(text);
        setSafeStatus("idle");
        speak(text, code);
      } catch (err: any) {
        setError(err.message || "Backend unreachable. Is the server running?");
        setSafeStatus("error");
      }
    },
    [speak]
  );

  const stopListening = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (maxRecordTimerRef.current) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }
    setListening(false);
  }, []);

  const startWebSpeechRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition is not supported in this browser. Try Chrome/Edge.");
      setSafeStatus("error");
      return;
    }
    setError("");
    setTranscript("");
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    const langOpt = findLang(langRef.current);
    rec.lang = langOpt.webCode;

    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      const shown = (finalText + interim).trim();
      setTranscript(shown);
      onTranscript?.(shown);
    };

    rec.onstart = () => {
      setListening(true);
      setSafeStatus("listening");
    };
    rec.onend = async () => {
      setListening(false);
      if (finalText.trim()) {
        setSafeStatus("thinking");
        await sendToAssistant(finalText.trim());
      } else {
        setSafeStatus("idle");
      }
    };
    rec.onerror = (e: any) => {
      setListening(false);
      console.warn("SpeechRecognition error:", e.error);
      if (e.error === "aborted" || e.error === "no-speech") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access denied. Allow mic permission (site settings) and retry.");
      } else if (e.error === "audio-capture") {
        setError("No microphone found. Check it's connected and allowed in your OS privacy settings.");
      } else if (e.error === "network") {
        setError(
          "Browser speech recognition couldn't reach Google's servers (network/firewall/VPN/ad-blocker). " +
            "Set a backendUrl to use Sarvam STT instead, which doesn't depend on that connection."
        );
      } else if (e.error === "language-not-supported") {
        setError("Speech recognition doesn't support this language in your browser. Try a different one.");
      } else {
        setError(`Could not hear you (${e.error}). Try again.`);
      }
      setSafeStatus("error");
    };

    recRef.current = rec;
    rec.start();
  }, [sendToAssistant]);

  const transcribeWithSarvam = useCallback(
    async (blob: Blob) => {
      const backend = backendRef.current;
      const code = langRef.current;
      try {
        const form = new FormData();
        form.append("file", blob, "audio.webm");
        form.append("language_code", findLang(code).webCode);
        const res = await fetch(`${backend}/api/stt`, { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `STT failed (${res.status})`);
        const text = (data.transcript || "").trim();
        if (!text) {
          setError("Could not hear you. Try again.");
          setSafeStatus("error");
          return;
        }
        setSafeStatus("thinking");
        await sendToAssistant(text);
      } catch (err: any) {
        console.warn("Sarvam STT failed, falling back to browser speech recognition:", err);
        startWebSpeechRecognition();
      }
    },
    [sendToAssistant, startWebSpeechRecognition]
  );

  const startSarvamRecording = useCallback(async () => {
    setError("");
    setTranscript("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      startWebSpeechRecognition();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstart = () => {
        setListening(true);
        setSafeStatus("listening");
      };
      rec.onstop = async () => {
        setListening(false);
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        if (maxRecordTimerRef.current) {
          clearTimeout(maxRecordTimerRef.current);
          maxRecordTimerRef.current = null;
        }
        const captured = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (captured.size < 800) {
          setSafeStatus("idle");
          return;
        }
        setSafeStatus("thinking");
        await transcribeWithSarvam(captured);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      maxRecordTimerRef.current = setTimeout(() => stopListening(), MAX_RECORD_MS);
    } catch (err: any) {
      console.warn("getUserMedia error:", err);
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        setError("Microphone access denied. Allow mic permission (site settings) and retry.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Check it's connected and allowed in your OS privacy settings.");
      } else {
        setError("Could not access the microphone. Try again.");
      }
      setSafeStatus("error");
    }
  }, [startWebSpeechRecognition, stopListening, transcribeWithSarvam]);

  const startListening = useCallback(() => {
    stopListening();
    const backend = backendRef.current;
    const { useSarvamStt } = optsRef.current;
    if (backend && useSarvamStt) {
      startSarvamRecording();
    } else {
      startWebSpeechRecognition();
    }
  }, [stopListening, startSarvamRecording, startWebSpeechRecognition]);

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setSafeStatus("thinking");
      sendToAssistant(text.trim());
    },
    [sendToAssistant]
  );

  const changeLanguage = useCallback(
    (code: string) => {
      stopListening();
      setLang(code);
      langRef.current = code;
      setAutoLang(false);
      autoLangRef.current = false;
    },
    [stopListening]
  );

  const resetToAutoLanguage = useCallback(() => {
    setAutoLang(true);
    autoLangRef.current = true;
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [stopListening]);

  return {
    lang,
    autoLang,
    status,
    transcript,
    reply,
    error,
    listening,
    languages: LANGUAGES,
    startListening,
    stopListening,
    sendText,
    changeLanguage,
    resetToAutoLanguage,
  };
}

function fallbackReply(message: string, _langCode: string): string {
  const greetings = ["hi", "hello", "namaste", "नमस्ते", "नमस्कार", "வணக்கம்", "నమస్తే", "নমস্কার", "ഹലോ", "ನಮಸ್ಕಾರ", "हॅलो", "નમસ્તે"];
  if (greetings.some((g) => message.toLowerCase().includes(g))) {
    return "Hey hey! I'm here to help — ask me anything, or switch languages up top. 👋";
  }
  return "Got it! Hook up the backend and I'll give you real smart replies in your language.";
}

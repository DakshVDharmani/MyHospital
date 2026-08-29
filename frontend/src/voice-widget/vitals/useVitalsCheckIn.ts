import { useCallback, useRef, useState } from "react";
import { findLang } from "../languages";
import { VITAL_QUESTIONS } from "./vitalsQuestions";
import { extractVitalAnswer } from "./extractVitals";
import { saveVitalsCheckIn } from "./vitalsApi";

export type CheckInPhase = "idle" | "asking" | "listening" | "processing" | "retry" | "done" | "error";

export interface CapturedVital {
  key: (typeof VITAL_QUESTIONS)[number]["key"];
  value: number | { systolic: number; diastolic: number };
}

const MAX_RECORD_MS = 8000;

// Purpose-built flow for the vitals check-in — separate from
// useVoiceAssistant because this asks fixed questions verbatim (no chat
// brain reply) and needs the STT language *back* to translate the answer to
// English before storing, neither of which the chat hook's flow does.
export function useVitalsCheckIn(backendUrl: string, patientId: string) {
  const [phase, setPhase] = useState<CheckInPhase>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [captured, setCaptured] = useState<CapturedVital[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [lang, setLang] = useState("en");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturedRef = useRef<CapturedVital[]>([]);
  const transcriptsRef = useRef<string[]>([]);
  const langsRef = useRef<string[]>([]);

  const question = VITAL_QUESTIONS[stepIndex];

  const speak = useCallback(
    async (text: string, langCode: string) => {
      let toSpeak = text;
      if (langCode !== "en") {
        try {
          const res = await fetch(`${backendUrl}/api/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, sourceLang: "en", targetLang: langCode }),
          });
          const data = await res.json();
          if (res.ok) toSpeak = data.translated_text || text;
        } catch {
          // fall back to speaking the English prompt
        }
      }
      try {
        const res = await fetch(`${backendUrl}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: toSpeak, lang: langCode }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      } catch {
        // no audio backend reachable — the on-screen question text still works
      }
    },
    [backendUrl]
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(
    async (all: CapturedVital[]) => {
      try {
        const get = (k: string) => all.find((c) => c.key === k)?.value;
        const bp = get("bloodPressure") as { systolic: number; diastolic: number } | undefined;
        await saveVitalsCheckIn(patientId, {
          systolic: bp?.systolic ?? null,
          diastolic: bp?.diastolic ?? null,
          heartRate: (get("heartRate") as number) ?? null,
          temperature: (get("temperature") as number) ?? null,
          spo2: (get("spo2") as number) ?? null,
          glucose: (get("glucose") as number) ?? null,
          sourceLang: langsRef.current[0] || "en",
          rawTranscript: transcriptsRef.current.join(" · "),
        });
        setPhase("done");
      } catch (err: any) {
        setErrorMsg(err.message || "Couldn't save your vitals — try again in a moment.");
        setPhase("error");
      }
    },
    [patientId]
  );

  const processAnswer = useCallback(
    async (blob: Blob) => {
      setPhase("processing");
      try {
        const form = new FormData();
        form.append("file", blob, "answer.webm");
        form.append("language_code", findLang(lang).webCode);
        const sttRes = await fetch(`${backendUrl}/api/stt`, { method: "POST", body: form });
        const sttData = await sttRes.json();
        if (!sttRes.ok) throw new Error(sttData.error || "Could not transcribe that.");

        const heard: string = (sttData.transcript || "").trim();
        const detectedLang: string = sttData.language_code || lang;
        setLiveTranscript(heard);
        if (!heard) throw new Error("Didn't catch anything — try again.");

        let english = heard;
        if (detectedLang !== "en") {
          const tRes = await fetch(`${backendUrl}/api/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: heard, sourceLang: detectedLang, targetLang: "en" }),
          });
          const tData = await tRes.json();
          if (tRes.ok) english = tData.translated_text || heard;
        }

        const value = extractVitalAnswer(question.key, english);
        if (value === null) {
          setErrorMsg(`Couldn't find a number in "${heard}" — try saying it again, e.g. "${question.exampleHint}".`);
          setPhase("retry");
          return;
        }

        transcriptsRef.current.push(`${question.label}: ${heard}`);
        langsRef.current.push(detectedLang);
        const next = [...capturedRef.current, { key: question.key, value }];
        capturedRef.current = next;
        setCaptured(next);

        if (stepIndex + 1 < VITAL_QUESTIONS.length) {
          setStepIndex((i) => i + 1);
          setLiveTranscript("");
          setPhase("idle"); // caller effect advances to the next question
        } else {
          await finish(next);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Something went wrong — try again.");
        setPhase("retry");
      }
    },
    [backendUrl, lang, question, stepIndex, finish]
  );

  const listen = useCallback(async () => {
    setErrorMsg("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMsg("Microphone isn't available in this browser — type your answer instead.");
      setPhase("retry");
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
      rec.onstart = () => setPhase("listening");
      rec.onstop = async () => {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 800) {
          setErrorMsg("Didn't catch that — try again.");
          setPhase("retry");
          return;
        }
        await processAnswer(blob);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      maxTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
    } catch (err: any) {
      setErrorMsg(
        err.name === "NotAllowedError" ? "Microphone access denied — allow it and try again, or type your answer." : "Couldn't access the microphone."
      );
      setPhase("retry");
    }
  }, [processAnswer, stopRecording]);

  const askCurrentQuestion = useCallback(async () => {
    setPhase("asking");
    await speak(question.promptEn, lang);
    await listen();
  }, [speak, listen, question, lang]);

  const submitTypedAnswer = useCallback(
    async (text: string) => {
      const value = extractVitalAnswer(question.key, text);
      if (value === null) {
        setErrorMsg(`Couldn't find a number in that — try e.g. "${question.exampleHint}".`);
        setPhase("retry");
        return;
      }
      transcriptsRef.current.push(`${question.label}: ${text}`);
      langsRef.current.push("en");
      const next = [...capturedRef.current, { key: question.key, value }];
      capturedRef.current = next;
      setCaptured(next);
      if (stepIndex + 1 < VITAL_QUESTIONS.length) {
        setStepIndex((i) => i + 1);
        setLiveTranscript("");
        setPhase("idle");
      } else {
        await finish(next);
      }
    },
    [question, stepIndex, finish]
  );

  const start = useCallback((startLang: string) => {
    setLang(startLang);
    setStepIndex(0);
    setCaptured([]);
    capturedRef.current = [];
    transcriptsRef.current = [];
    langsRef.current = [];
    setLiveTranscript("");
    setErrorMsg("");
    setPhase("idle");
  }, []);

  const cancel = useCallback(() => {
    stopRecording();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setPhase("idle");
  }, [stopRecording]);

  return {
    phase,
    question,
    stepIndex,
    totalSteps: VITAL_QUESTIONS.length,
    captured,
    liveTranscript,
    errorMsg,
    start,
    askCurrentQuestion,
    listen,
    stopRecording,
    submitTypedAnswer,
    cancel,
  };
}

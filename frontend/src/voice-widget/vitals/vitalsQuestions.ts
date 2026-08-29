import type { VitalKey } from "./extractVitals";

export interface VitalQuestion {
  key: VitalKey;
  label: string;
  unit: string;
  icon: string; // emoji, cheap + no extra asset
  promptEn: string;
  exampleHint: string;
}

// Asked one at a time, in this order. Keep prompts short — they're spoken
// out loud via TTS, and long prompts make the check-in feel slow.
export const VITAL_QUESTIONS: VitalQuestion[] = [
  {
    key: "bloodPressure",
    label: "Blood pressure",
    unit: "mmHg",
    icon: "🩸",
    promptEn: "What's your blood pressure? For example, say one twenty over eighty.",
    exampleHint: "e.g. 120/80",
  },
  {
    key: "heartRate",
    label: "Heart rate",
    unit: "bpm",
    icon: "💓",
    promptEn: "What's your heart rate, in beats per minute?",
    exampleHint: "e.g. 72",
  },
  {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    icon: "🌡️",
    promptEn: "What's your body temperature?",
    exampleHint: "e.g. 98.6°F or 37°C",
  },
  {
    key: "spo2",
    label: "Oxygen level",
    unit: "%",
    icon: "🫁",
    promptEn: "What's your oxygen level, or SpO2 percentage?",
    exampleHint: "e.g. 98%",
  },
  {
    key: "glucose",
    label: "Blood sugar",
    unit: "mg/dL",
    icon: "🍬",
    promptEn: "What's your blood sugar or glucose level?",
    exampleHint: "e.g. 110 mg/dL",
  },
];

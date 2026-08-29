// Self-contained copy of VoiceAsst's language config, kept local to this
// widget so LoginPages doesn't need a cross-package/workspace link into
// ../VoiceAsst (that project's folder structure is left untouched).
export interface LangOption {
  code: string;
  label: string;
  webCode: string;
}

export const LANGUAGES: LangOption[] = [
  { code: "hi", label: "🇮🇳 हिन्दी", webCode: "hi-IN" },
  { code: "en", label: "🇬🇧 English", webCode: "en-IN" },
  { code: "ta", label: "🇮🇳 தமிழ்", webCode: "ta-IN" },
  { code: "te", label: "🇮🇳 తెలుగు", webCode: "te-IN" },
  { code: "bn", label: "🇮🇳 বাংলা", webCode: "bn-IN" },
  { code: "ml", label: "🇮🇳 മലയാളം", webCode: "ml-IN" },
  { code: "kn", label: "🇮🇳 ಕನ್ನಡ", webCode: "kn-IN" },
  { code: "mr", label: "🇮🇳 मराठी", webCode: "mr-IN" },
  { code: "gu", label: "🇮🇳 ગુજરાતી", webCode: "gu-IN" },
];

export function findLang(code: string): LangOption {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

// Unicode-script based language guess so the widget can pick a language
// automatically instead of asking the user to set one. Devanagari is shared
// by Hindi and Marathi — this defaults that block to Hindi, which is the
// more common case and still lets the user override via the picker.
const SCRIPT_RANGES: { re: RegExp; code: string }[] = [
  { re: /[ऀ-ॿ]/, code: "hi" }, // Devanagari (Hindi/Marathi)
  { re: /[஀-௿]/, code: "ta" }, // Tamil
  { re: /[ఀ-౿]/, code: "te" }, // Telugu
  { re: /[ঀ-৿]/, code: "bn" }, // Bengali
  { re: /[ഀ-ൿ]/, code: "ml" }, // Malayalam
  { re: /[ಀ-೿]/, code: "kn" }, // Kannada
  { re: /[઀-૿]/, code: "gu" }, // Gujarati
];

/** Guesses a supported language code from a snippet of text. Returns null for
 * plain Latin text (ambiguous — could be English or romanized) or empty input. */
export function detectLangFromText(text: string): string | null {
  const sample = text.trim();
  if (!sample) return null;
  for (const { re, code } of SCRIPT_RANGES) {
    if (re.test(sample)) return code;
  }
  if (/[a-zA-Z]/.test(sample)) return "en";
  return null;
}

/** Best starting guess before the user has said anything: the browser/OS
 * language if we support it, else English. */
export function detectInitialLang(): string {
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  const short = nav.slice(0, 2).toLowerCase();
  return LANGUAGES.some((l) => l.code === short) ? short : "en";
}

export function findWebVoice(lang: LangOption): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.webCode.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.webCode.slice(0, 2))) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("hi")) ||
    voices[0] ||
    null
  );
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

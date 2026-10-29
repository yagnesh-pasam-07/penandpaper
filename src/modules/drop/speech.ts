/**
 * Helpers for the browser's own speech recogniser (the Web Speech API): no
 * server and no key. Pure, so the language choice, the text from partial
 * results and the error messages can be tested without a microphone.
 */

/** What Chrome, Edge and Safari hand over: a list of results, each with its best guess and whether it is settled. */
export type SpeechResultLike = { transcript: string; isFinal: boolean };

/** The few languages offered next to the mic. */
export const SPEECH_LANGS = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "te", label: "తెలుగు" },
] as const;
export type SpeechLang = (typeof SPEECH_LANGS)[number]["id"];

export const DEFAULT_SPEECH_LANG: SpeechLang = "en";

/** localStorage key that remembers the language on this device. */
export const SPEECH_LANG_KEY = "pp-voice-lang";

export function parseSpeechLang(value: unknown): SpeechLang | null {
  return SPEECH_LANGS.find((l) => l.id === value)?.id ?? null;
}

/** The language to start with: the browser's own when it is Hindi or Telugu, else English. */
export function defaultSpeechLang(navigatorLanguage: string | undefined | null): SpeechLang {
  const base = String(navigatorLanguage ?? "").toLowerCase().split("-")[0];
  return parseSpeechLang(base) ?? DEFAULT_SPEECH_LANG;
}

/**
 * The BCP-47 tag handed to the recogniser. English follows the browser's own
 * English (en-US, en-GB…) and is Indian English otherwise; Hindi and Telugu
 * are the Indian variants.
 */
export function speechTag(lang: SpeechLang, navigatorLanguage: string | undefined | null): string {
  if (lang === "hi") return "hi-IN";
  if (lang === "te") return "te-IN";
  const nav = String(navigatorLanguage ?? "");
  return /^en-[A-Za-z]{2}$/.test(nav) ? nav : "en-IN";
}

/** The words so far from a list of results: the settled part, and the part still being guessed. */
export function mergeSpeech(results: readonly SpeechResultLike[]): { final: string; interim: string } {
  const join = (parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(" ");
  return {
    final: join(results.filter((r) => r.isFinal).map((r) => r.transcript)),
    interim: join(results.filter((r) => !r.isFinal).map((r) => r.transcript)),
  };
}

/** Everything heard so far, settled and guessed, as one run of text. */
export function spokenSoFar(results: readonly SpeechResultLike[]): string {
  const { final, interim } = mergeSpeech(results);
  return [final, interim].filter(Boolean).join(" ");
}

/** What a recogniser error means for the person, or null when it isn't worth saying (we stopped it ourselves). */
export function speechErrorMessage(error: string): string | null {
  switch (error) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "The microphone or the speech service is blocked. Allow it for this site in the address bar.";
    case "no-speech":
      return "Didn't catch anything.";
    case "network":
      return "This browser's speech service needs the internet. Check your connection.";
    case "audio-capture":
      return "No microphone was found.";
    case "language-not-supported":
      return "This browser can't recognise that language. Pick another one.";
    default:
      return "Couldn't hear that. Try again.";
  }
}

/** The minimal shape of a recogniser, enough to drive it without the browser's own types. */
export type SpeechRecognizerLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export type SpeechRecognizerCtor = new () => SpeechRecognizerLike;

/** The browser's recogniser class, or null (Firefox has none). Chrome and Edge ship it prefixed; Safari 14.1+ too. */
export function speechCtor(win: { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown } | undefined): SpeechRecognizerCtor | null {
  const found = win?.SpeechRecognition ?? win?.webkitSpeechRecognition;
  return typeof found === "function" ? (found as SpeechRecognizerCtor) : null;
}

/** A recogniser's result list as plain results (each result's best alternative). */
export function resultsFrom(list: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>): SpeechResultLike[] {
  return Array.from({ length: list.length }, (_, i) => ({ transcript: list[i][0]?.transcript ?? "", isFinal: !!list[i].isFinal }));
}

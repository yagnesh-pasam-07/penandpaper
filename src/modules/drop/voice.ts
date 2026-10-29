import { MAX_THOUGHT } from "./logic";

/** The biggest recording taken, in bytes. A minute of speech is well under this. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
/** A recording stops by itself after this long, in the browser. */
export const MAX_RECORDING_MS = 60_000;
/** Transcriptions allowed per person in each window. */
export const VOICE_PER_WINDOW = 30;
export const VOICE_WINDOW_MS = 10 * 60_000;

/** What can be sent to the transcriber: the recording's type (without any `;codecs=…`) and the file extension to send it under. */
const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  // Raw AAC from some phones; the provider wants a container, so it is sent as m4a.
  "audio/aac": "m4a",
  // Chrome labels audio-only WebM from MediaRecorder this way on some versions.
  "video/webm": "webm",
};

/** `audio/webm;codecs=opus` → `audio/webm`. */
export function baseType(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

/** The file extension to send a recording under, or null for a type that isn't accepted. */
export function audioExtension(type: string): string | null {
  return AUDIO_TYPES[baseType(type)] ?? null;
}

export type AudioCheck = { ok: true; ext: string } | { ok: false; status: 400 | 413 | 415; error: string };

/** Whether a recording can be transcribed at all: it must have sound-sized content, fit the limit and be a known audio type. */
export function checkAudio(file: { type: string; size: number }): AudioCheck {
  if (!file.size) return { ok: false, status: 400, error: "That recording is empty." };
  if (file.size > MAX_AUDIO_BYTES) return { ok: false, status: 413, error: "That recording is too long. Keep it under a minute." };
  const ext = audioExtension(file.type);
  if (!ext) return { ok: false, status: 415, error: "That isn't an audio type we can read." };
  return { ok: true, ext };
}

/** The transcript as a thought: tidied and cut to a thought's length, or null when nothing was said. */
export function cleanTranscript(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, MAX_THOUGHT).trim();
  return text || null;
}

/** The best recording type this browser can make, preferring WebM/Opus and falling back to MP4 (Safari). Null when none. */
export function pickRecorderMime(isTypeSupported: (type: string) => boolean): string | null {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
  return candidates.find((type) => isTypeSupported(type)) ?? null;
}

/** `0:07`, `1:00`. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Puts spoken words into the writer's text at the cursor (or over the
 * selection), with a space where it would run two words together, cut at the
 * length of a thought. Returns the new text and where the cursor goes.
 */
export function insertAtCursor(text: string, insert: string, start: number, end: number, max = MAX_THOUGHT): { text: string; cursor: number } {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  const before = text.slice(0, from);
  const after = text.slice(to);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  const room = Math.max(0, max - before.length - after.length - lead.length - trail.length);
  const piece = insert.slice(0, room);
  if (!piece) return { text, cursor: from };
  const next = `${before}${lead}${piece}${trail}${after}`;
  return { text: next, cursor: before.length + lead.length + piece.length };
}

/** What the transcriber's answer means for the caller, without ever passing the provider's own message on. */
export type VoiceFailure = "not_configured" | "bad_audio" | "upstream" | "timeout";

export function failureResponse(reason: VoiceFailure): { status: number; error: string } {
  switch (reason) {
    case "not_configured":
      return { status: 503, error: "Voice isn't set up on this server yet." };
    case "bad_audio":
      return { status: 422, error: "Couldn't read that recording. Try again." };
    case "timeout":
      return { status: 504, error: "That took too long. Try a shorter recording." };
    default:
      return { status: 502, error: "Couldn't turn that into words right now. Try again." };
  }
}

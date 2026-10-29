import { cleanTranscript, type VoiceFailure } from "./voice";

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
/** Tried in this order: the second only when the first model isn't available to the key. */
export const MODELS = ["gpt-4o-mini-transcribe", "whisper-1"] as const;
const TIMEOUT_MS = 30_000;

export type Transcription = { ok: true; text: string | null } | { ok: false; reason: VoiceFailure };

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Sends a recording to OpenAI's speech-to-text and returns the words, or why
 * not. No language is passed, so Telugu, Hindi and English are all
 * detected from the audio. The provider's own error text is never returned or
 * logged with the key; the caller only learns which kind of failure it was.
 * `fetcher` is injectable so tests never touch the network.
 */
export async function transcribeAudio(
  audio: Blob,
  ext: string,
  apiKey: string | undefined,
  fetcher: Fetch = fetch,
): Promise<Transcription> {
  const key = apiKey?.trim();
  if (!key) return { ok: false, reason: "not_configured" };

  for (const [i, model] of MODELS.entries()) {
    const form = new FormData();
    form.append("file", audio, `voice.${ext}`);
    form.append("model", model);
    form.append("response_format", "json");
    let res: Response;
    try {
      res = await fetcher(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      return { ok: false, reason: e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "upstream" };
    }
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
      return { ok: true, text: cleanTranscript(body?.text) };
    }
    const last = i === MODELS.length - 1;
    // 404 (no such model for this key) or 400 about the model: try the next model.
    if (!last && (res.status === 404 || res.status === 400)) {
      const detail = await res.text().catch(() => "");
      if (res.status === 404 || /model/i.test(detail)) continue;
      return { ok: false, reason: "bad_audio" };
    }
    if (res.status === 400 || res.status === 415 || res.status === 413) return { ok: false, reason: "bad_audio" };
    if (res.status === 401 || res.status === 403) {
      console.error("transcribe: the OpenAI key was refused");
      return { ok: false, reason: "key_refused" };
    }
    console.error("transcribe: provider status", res.status);
    return { ok: false, reason: "upstream" };
  }
  return { ok: false, reason: "upstream" };
}

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
  prompt?: string,
): Promise<Transcription> {
  const key = apiKey?.trim();
  if (!key) return { ok: false, reason: "not_configured" };

  for (const [i, model] of MODELS.entries()) {
    const form = new FormData();
    form.append("file", audio, `voice.${ext}`);
    form.append("model", model);
    form.append("response_format", "json");
    if (prompt) form.append("prompt", prompt);
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

/* ---------- Groq: Whisper large-v3-turbo, free tier, tried first ---------- */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_MODEL = "whisper-large-v3-turbo";

/**
 * The same as transcribeAudio, through Groq's Whisper large-v3-turbo: the
 * model behind the accurate dictation people know from AI apps, strong on
 * Indian English and on code-switching (Telugu/Hindi with English), and free
 * for 2,000 recordings a day. `prompt` lists names and words to expect
 * ("Teja, Manikanta, payroll"), which is what makes Indian names come out right.
 */
export async function transcribeWithGroq(audio: Blob, ext: string, apiKey: string | undefined, prompt?: string, fetcher: Fetch = fetch): Promise<Transcription> {
  const key = apiKey?.trim();
  if (!key) return { ok: false, reason: "not_configured" };
  const form = new FormData();
  form.append("file", audio, `voice.${ext}`);
  form.append("model", GROQ_MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (prompt) form.append("prompt", prompt);
  let res: Response;
  try {
    res = await fetcher(GROQ_ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    return { ok: false, reason: e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "upstream" };
  }
  if (res.ok) {
    const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
    return { ok: true, text: cleanTranscript(body?.text) };
  }
  if (res.status === 400 || res.status === 415 || res.status === 413) return { ok: false, reason: "bad_audio" };
  if (res.status === 401 || res.status === 403) {
    console.error("transcribe: the Groq key was refused");
    return { ok: false, reason: "key_refused" };
  }
  console.error("transcribe: Groq status", res.status);
  return { ok: false, reason: "upstream" };
}

/**
 * The words to expect, as Whisper's prompt: names and terms from the paper
 * (capitalised words and @mentions), most frequent first, under ~600 characters.
 * Whisper reads the prompt as "what came before", so a short list of proper
 * nouns steers spelling without changing what was said.
 */
export function vocabularyPrompt(texts: string[], extra: string[] = []): string | undefined {
  const count = new Map<string, number>();
  const add = (w: string, n = 1) => {
    const clean = w.replace(/^@/, "").replace(/[^\p{L}\p{N}'-]/gu, "");
    if (clean.length < 3 || clean.length > 30) return;
    count.set(clean, (count.get(clean) ?? 0) + n);
  };
  extra.forEach((w) => add(w, 50));
  for (const t of texts) {
    for (const m of t.matchAll(/@[\p{L}][\p{L}\p{N}._-]*/gu)) add(m[0], 3);
    // Capitalised words not at the start of a sentence: names, places, products.
    for (const m of t.matchAll(/(?<=[\p{L}\p{N},;:)] )\p{Lu}[\p{L}'-]{2,}/gu)) add(m[0]);
  }
  const words = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
  let out = "";
  for (const w of words) {
    if (out.length + w.length + 2 > 600) break;
    out += (out ? ", " : "") + w;
  }
  return out ? `${out}.` : undefined;
}

/** Groq first (free, Whisper large-v3-turbo); OpenAI when Groq isn't set up or is down. */
export async function transcribeBest(audio: Blob, ext: string, keys: { groq?: string; openai?: string }, prompt?: string, fetcher: Fetch = fetch): Promise<Transcription> {
  const first = await transcribeWithGroq(audio, ext, keys.groq, prompt, fetcher);
  if (first.ok || first.reason === "bad_audio") return first;
  if (!keys.openai?.trim()) return first;
  return transcribeAudio(audio, ext, keys.openai, fetcher, prompt);
}

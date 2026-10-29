import { z } from "zod";
import { noStore, userFromRequest } from "@/modules/drop/http";
import { allowWithin } from "@/modules/drop/rate";
import { canCapture, captureText } from "@/modules/drop/share";
import { captureThought } from "@/modules/drop/server";
import { transcribeAudio } from "@/modules/drop/transcribe";
import { checkAudio, failureResponse, MAX_AUDIO_BYTES, VOICE_PER_WINDOW, VOICE_WINDOW_MS } from "@/modules/drop/voice";

const id = z.string().regex(/^[a-z0-9-]{6,40}$/);

const fail = (status: number, error: string, extra?: Record<string, string>) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...extra } });

/**
 * Turns a recording into words. Two kinds of sender, like the quick box:
 * this site's own pages (and the browser extension) with the session cookie,
 * or an app holding a personal access token in `Authorization: Bearer pp_…`.
 *
 * Multipart form: `audio` (the recording), and optionally `save=1` with an `id`
 * (6–40 of a–z, 0–9, hyphen): then the words are also saved as a thought on
 * the paper touched last, and a retry with the same `id` is still one note.
 * Replies `{ text }`, or with `save` `{ text, id, paperId, paperName }`.
 */
export async function POST(request: Request) {
  const viaToken = request.headers.has("authorization");
  if (!viaToken && !canCapture(request.headers, new URL(request.url).origin)) return fail(403, "Not from this site.");
  const who = await userFromRequest(request);
  if (who instanceof Response) return who;

  // A recording over the limit is refused before it is read.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES + 64 * 1024) return fail(413, "That recording is too long. Keep it under a minute.");

  if (!(await allowWithin(`pp-voice:${who.user.id}`, VOICE_PER_WINDOW, VOICE_WINDOW_MS))) {
    return fail(429, "That's a lot of voice notes. Wait a few minutes.", { "Retry-After": "600" });
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!form || !(audio instanceof File)) return fail(400, "Send the recording as `audio`.");
  const checked = checkAudio(audio);
  if (!checked.ok) return fail(checked.status, checked.error);

  const save = form.get("save") === "1";
  const thoughtId = save ? id.safeParse(form.get("id")) : null;
  if (save && !thoughtId?.success) return fail(400, "A saved recording needs an `id`.");

  const result = await transcribeAudio(audio, checked.ext, process.env.OPENAI_API_KEY);
  if (!result.ok) {
    const f = failureResponse(result.reason);
    return fail(f.status, f.error);
  }
  const text = captureText(result.text);
  if (!text) return fail(422, "Didn't catch anything.");

  if (!save || !thoughtId?.success) return Response.json({ text }, noStore);
  try {
    const done = await captureThought(who.user.id, { id: thoughtId.data, text });
    return Response.json({ text, id: done.thought.id, paperId: done.paperId, paperName: done.paperName?.trim() || null }, noStore);
  } catch {
    return fail(409, "Couldn't save that thought.");
  }
}

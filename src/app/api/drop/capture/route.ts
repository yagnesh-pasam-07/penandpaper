import { z } from "zod";
import { allowTokenSave } from "@/modules/drop/api-tokens";
import { noStore, userFromRequest } from "@/modules/drop/http";
import { pictureFromUrl } from "@/modules/drop/picture";
import { allowWithin } from "@/modules/drop/rate";
import { canCapture, captureText, cleanUrl } from "@/modules/drop/share";
import { captureTarget, captureThought } from "@/modules/drop/server";

const body = z.object({
  // Made by the sender for each try, so sending it twice (a retry) is one note.
  id: z.string().regex(/^[a-z0-9-]{6,40}$/),
  text: z.string().max(20_000),
  /** A picture on the web to tape onto the note (a highlighted image): fetched and shrunk here. */
  imageUrl: z.string().max(4000).optional(),
});

/**
 * Saves a thought onto the paper touched last. Three kinds of sender:
 * - this site's own quick box (`/capture`) and the browser extension, signed in
 *   with the session cookie (a web page can't send either `Origin`);
 * - an app holding a personal access token, `Authorization: Bearer pp_…`
 *   (rate-limited per token). The token is only read from that header.
 * With `imageUrl` the server fetches that picture (public addresses only, see
 * `modules/drop/preview.ts`) and keeps it on the note; if it can't, the words
 * are still saved and `imageSkipped` says so.
 * Replies `{ id, paperId, paperName, imageSkipped? }`.
 */
export async function POST(request: Request) {
  const viaToken = request.headers.has("authorization");
  if (!viaToken && !canCapture(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  const who = await userFromRequest(request);
  if (who instanceof Response) return who;
  if (who.tokenId && !(await allowTokenSave(who.tokenId))) {
    return Response.json({ error: "Too many saves. Wait a minute." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  const text = parsed.success ? captureText(parsed.data.text) : null;
  const imageUrl = parsed.success ? cleanUrl(parsed.data.imageUrl) : null;
  if (!parsed.success || (!text && !imageUrl)) return Response.json({ error: "Write something first." }, { status: 400 });
  // Fetching a picture costs the server a request, so it is counted like a preview.
  const image = imageUrl && (await allowWithin(`pp-picture:${who.user.id}`, 60, 60_000)) ? await pictureFromUrl(imageUrl) : null;
  if (!text && !image) return Response.json({ error: "Couldn't get that picture." }, { status: 400 });
  try {
    const done = await captureThought(who.user.id, { id: parsed.data.id, text: text ?? "", image });
    return Response.json({ id: done.thought.id, paperId: done.paperId, paperName: done.paperName?.trim() || null, ...(imageUrl && !image ? { imageSkipped: true } : {}) }, noStore);
  } catch {
    return Response.json({ error: "Couldn't save that thought." }, { status: 409 });
  }
}

/** Where a capture would land, so an app can say so before saving: `{ paperName }`. Token or signed in. */
export async function GET(request: Request) {
  const who = await userFromRequest(request);
  if (who instanceof Response) return who;
  const target = await captureTarget(who.user.id);
  return Response.json({ paperId: target.paperId, paperName: target.paperName?.trim() || null }, noStore);
}

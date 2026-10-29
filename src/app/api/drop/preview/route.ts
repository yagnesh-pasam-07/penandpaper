import { userFromRequest } from "@/modules/drop/http";
import { buildPreview, checkUrl, type PreviewData } from "@/modules/drop/preview";
import { netDeps } from "@/modules/drop/preview-net";
import { allowWithin } from "@/modules/drop/rate";
import { youtubeId } from "@/lib/linkify";

/** Answers kept for a day, per server instance, so a link pasted on several notes (or reloaded) is fetched once. */
const KEEP_MS = 24 * 60 * 60 * 1000;
const KEEP_MAX = 500;
const cache = new Map<string, { at: number; data: PreviewData }>();

function remembered(key: string): PreviewData | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > KEEP_MS) {
    cache.delete(key);
    return null;
  }
  // Most recently used goes to the back, so the front is what to drop first.
  cache.delete(key);
  cache.set(key, hit);
  return hit.data;
}

function remember(key: string, data: PreviewData) {
  cache.set(key, { at: Date.now(), data });
  while (cache.size > KEEP_MAX) cache.delete(cache.keys().next().value as string);
}

const headers = { "Cache-Control": "private, max-age=3600" };
const refuse = (error: string, status: number, extra: Record<string, string> = {}) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...extra } });

/**
 * `GET /api/drop/preview?url=https://…` → `{ url, finalUrl, title, description, image, siteName, favicon }`.
 * The SERVER fetches the page (never the visitor's browser), only after the
 * link has passed the checks in `modules/drop/preview.ts`. Signed in (same
 * site) or a Bearer token, 60 a minute each. YouTube links are refused: they
 * have their own thumbnail card.
 */
export async function GET(request: Request) {
  // A cookie login must come from this site; a page on another site can't make this request for the visitor.
  if (!request.headers.has("authorization")) {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "same-site" && site !== "none") return refuse("Not from this site.", 403);
  }
  const who = await userFromRequest(request);
  if (who instanceof Response) return who;
  if (!(await allowWithin(`pp-preview:${who.user.id}`, 60, 60_000))) return refuse("Too many previews. Wait a minute.", 429, { "Retry-After": "60" });

  const raw = new URL(request.url).searchParams.get("url") ?? "";
  const checked = checkUrl(raw);
  if (!checked.ok) return refuse("That link can't be previewed.", 422);
  if (youtubeId(checked.url.href)) return refuse("Videos have their own card.", 422);

  const key = checked.url.href;
  const hit = remembered(key);
  if (hit) return Response.json(hit, { headers });

  const result = await buildPreview(raw, netDeps);
  if (!result.ok) {
    if (result.reason === "timeout") return refuse("That page took too long.", 504);
    return refuse("That link can't be previewed.", 422);
  }
  remember(key, result.data);
  return Response.json(result.data, { headers });
}

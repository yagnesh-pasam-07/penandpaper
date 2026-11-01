import { revalidateTag } from "next/cache";
import { z } from "zod";
import { allowWithin } from "@/modules/drop/rate";
import { isSameSite } from "@/modules/drop/share";
import { isBot } from "@/modules/stories/reach";
import { addClaps, clapsOf, liveStoryId, readerKey } from "@/modules/stories/reach-server";
import { STORIES_TAG } from "@/modules/stories/server";

const reader = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const body = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/), reader, n: z.number().int().min(1).max(50) });
const noStore = { headers: { "Cache-Control": "no-store" } };

/** `GET /api/stories/clap?slug=&reader=`: the story's total and this reader's own claps. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const r = reader.safeParse(url.searchParams.get("reader"));
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !r.success) return Response.json({ mine: 0, total: 0 }, noStore);
  const id = await liveStoryId(slug).catch(() => null);
  if (!id) return Response.json({ mine: 0, total: 0 }, noStore);
  return Response.json(await clapsOf(id, readerKey(r.data)), noStore);
}

/**
 * `POST /api/stories/clap`: a reader clapped `n` times (the page batches quick
 * taps). From this site only, never a bot, at most 50 per reader per story,
 * rate-limited.
 */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin) || isBot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad clap." }, { status: 400 });
  const key = readerKey(parsed.data.reader);
  if (!(await allowWithin(`pp-clap:${key}`, 30, 60_000))) return Response.json({ error: "Slow down." }, { status: 429 });
  const id = await liveStoryId(parsed.data.slug);
  if (!id) return Response.json({ error: "No such story." }, { status: 404 });
  const out = await addClaps(id, key, parsed.data.n);
  // Rankings ("Most loved") catch up in the background; readers keep getting the fast cached page meanwhile.
  revalidateTag(STORIES_TAG, "max");
  return Response.json(out, noStore);
}

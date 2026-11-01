import { revalidateTag } from "next/cache";
import { z } from "zod";
import { allowWithin } from "@/modules/drop/rate";
import { isSameSite } from "@/modules/drop/share";
import { isBot } from "@/modules/stories/reach";
import { addClaps, claimClaps, clapsOf, liveStoryId, readerKey, userReader } from "@/modules/stories/reach-server";
import { STORIES_TAG } from "@/modules/stories/server";
import { currentUser } from "@/server/session";

const reader = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const body = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/), reader, n: z.number().int().min(1).max(50) });
const noStore = { headers: { "Cache-Control": "no-store" } };

/**
 * `GET /api/stories/clap?slug=&reader=`: the story's total, this reader's own
 * claps, and whether they're signed in. A signed-in reader's claps from this
 * browser (before they signed in) are claimed for their account first.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const r = reader.safeParse(url.searchParams.get("reader"));
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !r.success) return Response.json({ mine: 0, total: 0, signedIn: false }, noStore);
  const [id, user] = await Promise.all([liveStoryId(slug).catch(() => null), currentUser().catch(() => null)]);
  if (!id) return Response.json({ mine: 0, total: 0, signedIn: !!user }, noStore);
  if (user) await claimClaps(readerKey(r.data), user.id).catch(() => {});
  const out = await clapsOf(id, user ? userReader(user.id) : readerKey(r.data));
  return Response.json({ ...out, signedIn: !!user }, noStore);
}

/**
 * `POST /api/stories/clap`: a signed-in reader clapped `n` times (the page
 * batches quick taps). A clap carries a person, so signing in is required
 * (401 tells the page to ask). From this site only, never a bot, at most 50
 * per person per story, rate-limited.
 */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin) || isBot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad clap." }, { status: 400 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in to clap." }, { status: 401 });
  const key = userReader(user.id);
  if (!(await allowWithin(`pp-clap:${key}`, 30, 60_000))) return Response.json({ error: "Slow down." }, { status: 429 });
  const id = await liveStoryId(parsed.data.slug);
  if (!id) return Response.json({ error: "No such story." }, { status: 404 });
  const out = await addClaps(id, key, parsed.data.n, user.id);
  // Rankings ("Most loved") catch up in the background; readers keep getting the fast cached page meanwhile.
  revalidateTag(STORIES_TAG, "max");
  return Response.json(out, noStore);
}

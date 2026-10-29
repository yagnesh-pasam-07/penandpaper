import { cookies } from "next/headers";
import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { dropZone } from "@/modules/drop/server";
import { isSameSite } from "@/modules/drop/share";
import { resolveTz, TZ_COOKIE } from "@/modules/drop/tonight";
import { nextTonightCard, reviewThought, tonightCounts } from "@/modules/drop/tonight-server";

const body = z.object({
  thoughtId: z.string().regex(/^[A-Za-z0-9-]{6,64}$/),
  action: z.enum(["strike", "keep", "crumple", "undo"]),
});

/** The viewer's time zone, from the cookie the browser sets (checked, with the Drop zone as the fallback). */
async function zoneOf(): Promise<string> {
  return resolveTz((await cookies()).get(TZ_COOKIE)?.value, dropZone());
}

/**
 * Where tonight's review stands, for today in the viewer's zone:
 * `{ date, total, reviewed, remaining, completed, summary: { struck, kept, crumpled }, next }`,
 * `next` being the oldest thought not decided yet (or null). With `?lite=1`
 * `next` is left out (the header button only needs the numbers).
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const tz = await zoneOf();
  const lite = new URL(request.url).searchParams.get("lite") === "1";
  const [counts, next] = await Promise.all([tonightCounts(user.id, tz), lite ? null : nextTonightCard(user.id, tz)]);
  return Response.json(lite ? counts : { ...counts, next }, noStore);
}

/**
 * Decides one thought: `{ thoughtId, action }` with action `strike`, `keep`,
 * `crumple`, or `undo` (back to how it was before the review). Same-site only
 * (it changes things). Replies the day's numbers: `{ date, total, reviewed,
 * remaining, completed, summary }`. Sending the same action twice is the same
 * as sending it once.
 */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That didn't come through. Try again." }, { status: 400 });
  const result = await reviewThought(user.id, parsed.data.thoughtId, parsed.data.action, await zoneOf());
  if (result === "not_found") return Response.json({ error: "That thought isn't on your papers." }, { status: 404 });
  if (result === "not_reviewable") return Response.json({ error: "That thought was changed outside tonight's review." }, { status: 409 });
  return Response.json(result, noStore);
}

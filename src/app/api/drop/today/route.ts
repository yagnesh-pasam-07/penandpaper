import { cookies } from "next/headers";
import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { parseRecallTime } from "@/modules/drop/recall";
import { actOnRecall, noteZone, recallSettings, recallState, saveRecallSettings } from "@/modules/drop/recall-server";
import { dropZone } from "@/modules/drop/server";
import { isSameSite } from "@/modules/drop/share";
import { resolveTz, TZ_COOKIE } from "@/modules/drop/tonight";

/** The viewer's zone: the browser's, sent with `?tz=` or the cookie, else the site's. */
async function zone(request: Request): Promise<string> {
  const asked = new URL(request.url).searchParams.get("tz");
  return resolveTz(asked ?? (await cookies()).get(TZ_COOKIE)?.value, dropZone());
}

/**
 * `GET` → the Thought of the Day state: `{ thought, due, sound, left }` (the
 * thought only when it is due now, unless `?force=1`), and the settings with
 * `?settings=1`. Also remembers the browser's zone for the daily notification.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  if (url.searchParams.get("settings") === "1") return Response.json(await recallSettings(user.id), noStore);
  const tz = await zone(request);
  await noteZone(user.id, tz);
  return Response.json(await recallState(user.id, tz, new Date(), url.searchParams.get("force") === "1"), noStore);
}

const body = z.union([
  z.object({ thoughtId: z.string().regex(/^[A-Za-z0-9-]{6,64}$/), action: z.enum(["use", "tomorrow", "another", "seen"]) }),
  z.object({
    settings: z.object({
      on: z.boolean().optional(),
      time: z.string().nullable().optional(),
      days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
      sound: z.boolean().optional(),
    }),
  }),
]);

/**
 * `{ thoughtId, action }`: Use it (onto today's paper), Tomorrow (later, spaced
 * further each time), Another (pass over for today) or Seen (closed). Replies
 * `{ paperId, newId }` for Use it, and the next thought for Another.
 * `{ settings }`: the recall time ("HH:MM", or null for "when I open"), days,
 * sound and on/off. Same-site only.
 */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That didn't come through. Try again." }, { status: 400 });
  if ("settings" in parsed.data) {
    const s = parsed.data.settings;
    if (s.time !== undefined && s.time !== null && !parseRecallTime(s.time)) return Response.json({ error: "Pick a time like 09:00." }, { status: 400 });
    await saveRecallSettings(user.id, { ...s, time: s.time === undefined ? undefined : s.time && parseRecallTime(s.time) });
    return Response.json(await recallSettings(user.id), noStore);
  }
  const tz = await zone(request);
  const { thoughtId, action } = parsed.data;
  const done = await actOnRecall(user.id, thoughtId, action, tz);
  if (!done.ok) return Response.json({ error: "That thought isn't on your papers." }, { status: 404 });
  if (action === "another") return Response.json(await recallState(user.id, tz, new Date(), true), noStore);
  return Response.json({ paperId: done.paperId ?? null, newId: done.newId ?? null }, noStore);
}

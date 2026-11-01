import { z } from "zod";
import { allowWithin } from "@/modules/drop/rate";
import { isSameSite } from "@/modules/drop/share";
import { CHANNELS, deviceOf, EVENT_KINDS, isBot, sourceOf } from "@/modules/stories/reach";
import { liveStoryId, readerKey, recordEvent } from "@/modules/stories/reach-server";

const body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  kind: z.enum(EVENT_KINDS),
  reader: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  channel: z.enum(CHANNELS).optional(),
  tag: z.string().max(12).optional(),
  referrer: z.string().max(500).optional(),
});

/**
 * `POST /api/stories/event`: a reader opened, finished, listened to or shared
 * a story. Anonymous (a random id the browser keeps, keyed on the server),
 * from this site only, bots ignored, at most 120 a minute per reader. Always
 * answers 204, so a reader never sees an error for this.
 */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  const url = new URL(request.url);
  if (!isSameSite(request.headers, url.origin) || isBot(request.headers.get("user-agent"))) return done;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return done;
  const e = parsed.data;
  const reader = readerKey(e.reader);
  try {
    if (!(await allowWithin(`pp-story-ev:${reader}`, 120, 60_000))) return done;
    const storyId = await liveStoryId(e.slug);
    if (!storyId) return done;
    await recordEvent({
      storyId,
      kind: e.kind,
      reader,
      channel: e.kind === "share" ? (e.channel ?? "other") : null,
      source: e.kind === "view" ? sourceOf(e.tag, e.referrer, url.hostname) : null,
      device: deviceOf(request.headers.get("user-agent")),
    });
  } catch {
    // Counting must never break reading.
  }
  return done;
}

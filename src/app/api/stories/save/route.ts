import { z } from "zod";
import { isSameSite } from "@/modules/drop/share";
import { isSaved, liveStoryId, setSaved } from "@/modules/stories/reach-server";
import { currentUser } from "@/server/session";

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const noStore = { headers: { "Cache-Control": "no-store" } };

/** `GET /api/stories/save?slug=`: whether the signed-in reader saved this story. */
export async function GET(request: Request) {
  const s = slug.safeParse(new URL(request.url).searchParams.get("slug"));
  const user = await currentUser().catch(() => null);
  if (!s.success || !user) return Response.json({ saved: false, signedIn: !!user }, noStore);
  const id = await liveStoryId(s.data).catch(() => null);
  return Response.json({ saved: id ? await isSaved(user.id, id) : false, signedIn: true }, noStore);
}

/** `POST /api/stories/save` `{ slug, saved }`: save or unsave for later. Signed-in readers only. */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in to save stories." }, { status: 401 });
  const b = z.object({ slug, saved: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const id = await liveStoryId(b.data.slug);
  if (!id) return Response.json({ error: "No such story." }, { status: 404 });
  return Response.json({ saved: await setSaved(user.id, id, b.data.saved) }, noStore);
}

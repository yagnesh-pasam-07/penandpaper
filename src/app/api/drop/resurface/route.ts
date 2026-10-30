import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { resolveResurface, setResurface, todaysResurface } from "@/modules/drop/resurface-server";
import { isSameSite } from "@/modules/drop/share";

/** `GET` → `{ card }`: the thought that comes back this morning, or `{ card: null }`. */
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return Response.json({ card: await todaysResurface(user.id) }, noStore);
}

const body = z.union([
  z.object({ thoughtId: z.string().regex(/^[A-Za-z0-9-]{6,64}$/), choice: z.enum(["act", "keep", "let_go", "later"]) }),
  z.object({ enabled: z.boolean() }),
]);

/**
 * `{ thoughtId, choice }`: settle a thought that came back (do it, keep, let go,
 * later). `{ enabled }`: switch the morning resurface and Sunday rewind on or
 * off. Same-site only. Replies the next card, if one is due.
 */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That didn't come through. Try again." }, { status: 400 });
  if ("enabled" in parsed.data) {
    await setResurface(user.id, parsed.data.enabled);
    return Response.json({ ok: true }, noStore);
  }
  if (!(await resolveResurface(user.id, parsed.data.thoughtId, parsed.data.choice))) return Response.json({ error: "That thought isn't on your papers." }, { status: 404 });
  return new Response(null, { status: 204, ...noStore });
}

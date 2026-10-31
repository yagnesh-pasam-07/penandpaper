import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { resolveResurface, setResurface } from "@/modules/drop/resurface-server";
import { isSameSite } from "@/modules/drop/share";

const body = z.union([
  z.object({ thoughtId: z.string().regex(/^[A-Za-z0-9-]{6,64}$/), choice: z.enum(["act", "keep", "let_go", "later"]) }),
  z.object({ enabled: z.boolean() }),
]);

/**
 * `{ thoughtId, choice }`: settle a thought from the Sunday rewind (do it,
 * keep, let go, later). `{ enabled }`: switch Thought of the Day and the
 * rewind on or off. Same-site only.
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

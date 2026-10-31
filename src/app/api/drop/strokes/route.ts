import { z } from "zod";
import { MAX_STROKE_POINTS, STROKE_LIMIT } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { addStroke, PaperNotFound } from "@/modules/drop/server";

const coord = z.number().finite().min(-STROKE_LIMIT).max(STROKE_LIMIT);
const thoughtId = z.string().regex(/^[a-z0-9-]{6,40}$/);

const body = z.object({
  paperId: z.uuid(),
  id: z.string().regex(/^[a-z0-9-]{6,40}$/),
  /** The line in canvas px, already smoothed and thinned in the browser. */
  points: z.array(z.tuple([coord, coord])).min(1).max(MAX_STROKE_POINTS),
  /** The thoughts its ends are tied to (a connector), or null. */
  fromId: thoughtId.nullable(),
  toId: thoughtId.nullable(),
});

/** Draws a line (or a connector) on a paper. Signed in from this site. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That line didn't come through. Try again." }, { status: 400 });
  const { paperId, ...stroke } = parsed.data;
  try {
    return Response.json(await addStroke(user.id, paperId, stroke), noStore);
  } catch (e) {
    if (e instanceof PaperNotFound) return Response.json({ error: "That paper isn't there any more." }, { status: 404 });
    return Response.json({ error: "Couldn't save that line." }, { status: 409 });
  }
}

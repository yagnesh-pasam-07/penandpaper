import { z } from "zod";
import { INKS, MAX_LABEL, MAX_STROKE_POINTS, SHAPES, STROKE_LIMIT } from "@/modules/drop/logic";
import { noStore, requireEditor } from "@/modules/drop/http";
import { broadcast, tabOf } from "@/modules/drop/live-server";
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
  color: z.enum(INKS).optional(),
  /** A shape: `points` is then its two opposite corners. */
  shape: z.enum(SHAPES).nullable().optional(),
  label: z.string().trim().max(MAX_LABEL).nullable().optional(),
}).refine((s) => !s.shape || s.points.length === 2, "A shape is two corners.");

/** Draws a line (or a connector) on a paper: the owner's, or one shared with them to edit. Signed in from this site. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That line didn't come through. Try again." }, { status: 400 });
  const { paperId, ...stroke } = parsed.data;
  const ed = await requireEditor(paperId);
  if (ed instanceof Response) return ed;
  try {
    const saved = await addStroke(ed.ownerId, paperId, stroke, ed.user.id);
    await broadcast(paperId, { type: "stroke", stroke: saved }, tabOf(request));
    return Response.json(saved, noStore);
  } catch (e) {
    if (e instanceof PaperNotFound) return Response.json({ error: "That paper isn't there any more." }, { status: 404 });
    return Response.json({ error: "Couldn't save that line." }, { status: 409 });
  }
}

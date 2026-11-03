import { z } from "zod";
import { INKS, MAX_LABEL, MAX_STROKE_POINTS, STROKE_LIMIT } from "@/modules/drop/logic";
import { requireEditor } from "@/modules/drop/http";
import { broadcast, tabOf } from "@/modules/drop/live-server";
import { eraseStroke, strokeOn, updateStroke } from "@/modules/drop/server";

const coord = z.number().finite().min(-STROKE_LIMIT).max(STROKE_LIMIT);
const thoughtId = z.string().regex(/^[a-z0-9-]{6,40}$/);
const change = z.object({
  paperId: z.uuid(),
  /** Brings an erased line back (an undo). */
  restore: z.literal(true).optional(),
  points: z.array(z.tuple([coord, coord])).min(1).max(MAX_STROKE_POINTS).optional(),
  color: z.enum(INKS).optional(),
  label: z.string().trim().max(MAX_LABEL).nullable().optional(),
  fromId: thoughtId.nullable().optional(),
  toId: thoughtId.nullable().optional(),
});

const gone = () => Response.json({ error: "That line isn't on this paper." }, { status: 404 });

/** Erases a line: hidden at once, swept up a week later. The paper goes in the query: `?paper=<id>`. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/drop/strokes/[id]">) {
  const paper = z.uuid().safeParse(new URL(request.url).searchParams.get("paper"));
  if (!paper.success) return Response.json({ error: "Which paper?" }, { status: 400 });
  const ed = await requireEditor(paper.data);
  if (ed instanceof Response) return ed;
  const { id } = await ctx.params;
  if (!(await eraseStroke(ed.ownerId, paper.data, id, true, ed.user.id))) return gone();
  await broadcast(paper.data, { type: "stroke-gone", id }, tabOf(request));
  return new Response(null, { status: 204 });
}

/**
 * Changes a line or shape: moved or reshaped (`points`), re-coloured, re-tied, the words inside.
 * With nothing but `{ "paperId" }` (or `restore: true`), brings an erased line back (an undo).
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/drop/strokes/[id]">) {
  const parsed = change.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That change didn't come through." }, { status: 400 });
  const { id } = await ctx.params;
  const { paperId, restore, ...rest } = parsed.data;
  const ed = await requireEditor(paperId);
  if (ed instanceof Response) return ed;
  const tab = tabOf(request);
  const edits = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (restore || !Object.keys(edits).length) {
    if (!(await eraseStroke(ed.ownerId, paperId, id, false, ed.user.id))) return gone();
    const back = await strokeOn(paperId, id);
    if (back) await broadcast(paperId, { type: "stroke", stroke: back }, tab);
    return new Response(null, { status: 204 });
  }
  if (!(await updateStroke(ed.ownerId, paperId, id, edits, ed.user.id))) return gone();
  await broadcast(paperId, { type: "stroke-edit", id, change: edits }, tab);
  return new Response(null, { status: 204 });
}

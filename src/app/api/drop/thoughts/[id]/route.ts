import { z } from "zod";
import { INKS, MAX_TEXT_SIZE, MAX_THOUGHT, MIN_TEXT_SIZE, type Thought } from "@/modules/drop/logic";
import { noStore, requireEditor, userFromRequest } from "@/modules/drop/http";
import { broadcast, tabOf, thoughtEvent } from "@/modules/drop/live-server";
import { crumpleThought, setThoughtKind, thoughtOn, uncrumpleThought, updateThought } from "@/modules/drop/server";

const patch = z
  .object({
    paperId: z.uuid(),
    text: z.string().trim().min(1).max(MAX_THOUGHT).optional(),
    status: z.enum(["open", "done"]).optional(),
    /** Written text's size (a corner dragged). */
    size: z.number().min(MIN_TEXT_SIZE).max(MAX_TEXT_SIZE).optional(),
    color: z.enum(INKS).optional(),
    /** A to-do's day, with or without a time (a reminder); null takes it off. */
    due: z.object({ at: z.iso.datetime({ offset: true }), hasTime: z.boolean() }).nullable().optional(),
    /** When it happens (a countdown, on anything): a day and an optional last day; null takes it off. */
    happens: z.object({ on: z.iso.date(), until: z.iso.date().nullable() }).refine((h) => !h.until || h.until >= h.on, "The end is before the start.").nullable().optional(),
    /** Written text ⇄ a to-do with a checkbox (a hand-cut note stays a note; a picture is always a drop). */
    kind: z.enum(["text", "todo"]).optional(),
    /** Takes a crumple back (an undo). */
    restore: z.literal(true).optional(),
  })
  .refine((p) => p.text !== undefined || p.status !== undefined || p.size !== undefined || p.color !== undefined || p.due !== undefined || p.kind !== undefined || p.happens !== undefined || p.restore);

const gone = () => Response.json({ error: "That thought isn't on this paper." }, { status: 404 });

export async function PATCH(request: Request, ctx: RouteContext<"/api/drop/thoughts/[id]">) {
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { id } = await ctx.params;
  const { paperId, kind, restore, ...change } = parsed.data;
  const ed = await requireEditor(paperId);
  if (ed instanceof Response) return ed;
  // Dates and reminders are the owner's own planning: a guest can't set them.
  if (change.due !== undefined && ed.ownerId !== ed.user.id) return Response.json({ error: "Only the paper's owner sets dates." }, { status: 403 });
  const tab = tabOf(request);
  // A guest never gets the owner's dates back.
  const mine = (t: Thought): Thought => (ed.ownerId === ed.user.id ? t : { ...t, dueAt: null, dueHasTime: false });
  if (restore) {
    if (!(await uncrumpleThought(ed.ownerId, paperId, id, ed.user.id))) return gone();
    const back = await thoughtOn(ed.ownerId, paperId, id);
    if (back) await broadcast(paperId, thoughtEvent(back), tab);
    return new Response(null, { status: 204 });
  }
  if (kind) {
    const k = await setThoughtKind(ed.ownerId, paperId, id, kind, ed.user.id);
    if (!k) return gone();
    if (!Object.values(change).some((v) => v !== undefined)) {
      await broadcast(paperId, thoughtEvent(k), tab);
      return Response.json(mine(k), noStore);
    }
  }
  const thought = await updateThought(ed.ownerId, paperId, id, change, ed.user.id);
  if (!thought) return gone();
  await broadcast(paperId, thoughtEvent(thought), tab);
  return Response.json(mine(thought), noStore);
}

/** Crumples it: hidden at once, swept up for good a week later. The paper goes in the query: `?paper=<id>`. A session or a Bearer token. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/drop/thoughts/[id]">) {
  // The Mac app undoes a save with its token; the web app uses the signed-in session.
  const who = await userFromRequest(request);
  if (who instanceof Response) return who;
  const paper = z.uuid().safeParse(new URL(request.url).searchParams.get("paper"));
  if (!paper.success) return Response.json({ error: "Which paper?" }, { status: 400 });
  // A token only ever reaches its own papers; a signed-in editor reaches papers shared with them too.
  const ed = who.tokenId ? { ownerId: who.user.id } : await requireEditor(paper.data, who.user);
  if (ed instanceof Response) return ed;
  const { id } = await ctx.params;
  if (!(await crumpleThought(ed.ownerId, paper.data, id, "user" in ed ? ed.user.id : undefined))) return gone();
  await broadcast(paper.data, { type: "gone", id }, tabOf(request));
  return new Response(null, { status: 204 });
}

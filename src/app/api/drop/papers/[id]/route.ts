import { z } from "zod";
import { MAX_PAPER_NAME } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { accessTo, broadcast, tabOf } from "@/modules/drop/live-server";
import { currentUser } from "@/server/session";
import { setPaperDates, archivePaper, deletePaper, getPaper, renamePaper, restorePaper } from "@/modules/drop/server";

const gone = () => Response.json({ error: "That paper isn't there." }, { status: 404 });
const badId = () => Response.json({ error: "Not a paper." }, { status: 400 });

/**
 * A paper with its thoughts: the owner's own, or one shared with them (or a
 * public link's, `?t=<token>`), as a live paper re-reads it after a reconnect.
 * Anyone but the owner gets it without due dates.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/drop/papers/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return badId();
  const token = new URL(request.url).searchParams.get("t");
  const user = await currentUser().catch(() => null);
  if (!user && !token) return Response.json({ error: "Sign in to use your paper." }, { status: 401 });
  const access = await accessTo(id, user, token);
  if (!access) return gone();
  const paper = await getPaper(access.ownerId, id);
  if (!paper) return gone();
  if (access.role === "owner") return Response.json(paper, noStore);
  const { thoughts, strokes, name, createdAt, happensOn, happensUntil } = paper;
  return Response.json({ id, name, createdAt, archivedAt: null, happensOn, happensUntil, strokes, thoughts: thoughts.map((t) => ({ ...t, dueAt: null, dueHasTime: false })) }, noStore);
}

const patch = z
  .object({
    /** Blank clears the name. */
    name: z.string().max(MAX_PAPER_NAME * 2).nullable().optional(),
    archived: z.boolean().optional(),
    /** Only `false` is allowed: it takes a deleted paper back (the undo). */
    deleted: z.literal(false).optional(),
    /** The paper's own dates (a trip): a day and an optional last day; null takes them off. */
    dates: z.object({ on: z.iso.date(), until: z.iso.date().nullable() }).refine((h) => !h.until || h.until >= h.on, "The end is before the start.").nullable().optional(),
  })
  .refine((p) => p.name !== undefined || p.archived !== undefined || p.deleted !== undefined || p.dates !== undefined);

/** Renames, archives or unarchives, or restores a paper. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/drop/papers/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return badId();
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { name, archived, deleted, dates } = parsed.data;
  // A restore comes first: the other changes only apply to a paper that is there.
  if (deleted === false && !(await restorePaper(user.id, id))) return gone();
  if (name !== undefined && !(await renamePaper(user.id, id, name))) return gone();
  if (archived !== undefined && !(await archivePaper(user.id, id, archived))) return gone();
  if (dates !== undefined) {
    if (!(await setPaperDates(user.id, id, dates))) return gone();
    // Everyone with it open sees the new dates.
    await broadcast(id, { type: "sync" }, tabOf(request));
  }
  return Response.json({ ok: true }, noStore);
}

/** Deletes it: hidden at once, kept a week for an undo, then swept up. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/drop/papers/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return badId();
  return (await deletePaper(user.id, id)) ? new Response(null, { status: 204 }) : gone();
}

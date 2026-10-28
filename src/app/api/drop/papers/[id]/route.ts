import { z } from "zod";
import { MAX_PAPER_NAME } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { archivePaper, deletePaper, getPaper, renamePaper, restorePaper } from "@/modules/drop/server";

const gone = () => Response.json({ error: "That paper isn't there." }, { status: 404 });
const badId = () => Response.json({ error: "Not a paper." }, { status: 400 });

/** A paper with its thoughts. */
export async function GET(_request: Request, ctx: RouteContext<"/api/drop/papers/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return badId();
  const paper = await getPaper(user.id, id);
  return paper ? Response.json(paper, noStore) : gone();
}

const patch = z
  .object({
    /** Blank clears the name. */
    name: z.string().max(MAX_PAPER_NAME * 2).nullable().optional(),
    archived: z.boolean().optional(),
    /** Only `false` is allowed: it takes a deleted paper back (the undo). */
    deleted: z.literal(false).optional(),
  })
  .refine((p) => p.name !== undefined || p.archived !== undefined || p.deleted !== undefined);

/** Renames, archives or unarchives, or restores a paper. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/drop/papers/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return badId();
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { name, archived, deleted } = parsed.data;
  // A restore comes first: the other changes only apply to a paper that is there.
  if (deleted === false && !(await restorePaper(user.id, id))) return gone();
  if (name !== undefined && !(await renamePaper(user.id, id, name))) return gone();
  if (archived !== undefined && !(await archivePaper(user.id, id, archived))) return gone();
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

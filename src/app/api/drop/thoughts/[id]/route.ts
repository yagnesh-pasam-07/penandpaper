import { z } from "zod";
import { MAX_THOUGHT } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { crumpleThought, updateThought } from "@/modules/drop/server";

const patch = z
  .object({ text: z.string().trim().min(1).max(MAX_THOUGHT).optional(), status: z.enum(["open", "done"]).optional() })
  .refine((p) => p.text !== undefined || p.status !== undefined);

const gone = () => Response.json({ error: "That thought isn't on today's paper." }, { status: 404 });

export async function PATCH(request: Request, ctx: RouteContext<"/api/drop/thoughts/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { id } = await ctx.params;
  const thought = await updateThought(user.id, id, parsed.data);
  return thought ? Response.json(thought, noStore) : gone();
}

/** Crumples it: hidden at once, swept up for good a week later. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/drop/thoughts/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  return (await crumpleThought(user.id, id)) ? new Response(null, { status: 204 }) : gone();
}

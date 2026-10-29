import { z } from "zod";
import { MAX_THOUGHT } from "@/modules/drop/logic";
import { noStore, requireUser, userFromRequest } from "@/modules/drop/http";
import { crumpleThought, updateThought } from "@/modules/drop/server";

const patch = z
  .object({ paperId: z.uuid(), text: z.string().trim().min(1).max(MAX_THOUGHT).optional(), status: z.enum(["open", "done"]).optional() })
  .refine((p) => p.text !== undefined || p.status !== undefined);

const gone = () => Response.json({ error: "That thought isn't on this paper." }, { status: 404 });

export async function PATCH(request: Request, ctx: RouteContext<"/api/drop/thoughts/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { id } = await ctx.params;
  const { paperId, ...change } = parsed.data;
  const thought = await updateThought(user.id, paperId, id, change);
  return thought ? Response.json(thought, noStore) : gone();
}

/** Crumples it: hidden at once, swept up for good a week later. The paper goes in the query: `?paper=<id>`. A session or a Bearer token. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/drop/thoughts/[id]">) {
  // The Mac app undoes a save with its token; the web app uses the signed-in session.
  const who = await userFromRequest(request);
  if (who instanceof Response) return who;
  const { user } = who;
  const paper = z.uuid().safeParse(new URL(request.url).searchParams.get("paper"));
  if (!paper.success) return Response.json({ error: "Which paper?" }, { status: 400 });
  const { id } = await ctx.params;
  return (await crumpleThought(user.id, paper.data, id)) ? new Response(null, { status: 204 }) : gone();
}

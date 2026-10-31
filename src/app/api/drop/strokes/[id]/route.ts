import { z } from "zod";
import { requireUser } from "@/modules/drop/http";
import { eraseStroke } from "@/modules/drop/server";

const gone = () => Response.json({ error: "That line isn't on this paper." }, { status: 404 });

/** Erases a line: hidden at once, swept up a week later. The paper goes in the query: `?paper=<id>`. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/drop/strokes/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const paper = z.uuid().safeParse(new URL(request.url).searchParams.get("paper"));
  if (!paper.success) return Response.json({ error: "Which paper?" }, { status: 400 });
  const { id } = await ctx.params;
  return (await eraseStroke(user.id, paper.data, id)) ? new Response(null, { status: 204 }) : gone();
}

/** Brings an erased line back (an undo). Body: `{ "paperId" }`. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/drop/strokes/[id]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = z.object({ paperId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Which paper?" }, { status: 400 });
  const { id } = await ctx.params;
  return (await eraseStroke(user.id, parsed.data.paperId, id, false)) ? new Response(null, { status: 204 }) : gone();
}

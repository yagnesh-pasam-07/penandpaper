import { z } from "zod";
import { X_SHARE_LIMIT, Y_LIMIT } from "@/components/canvas/arrange";
import { noStore, requireEditor } from "@/modules/drop/http";
import { broadcast, tabOf } from "@/modules/drop/live-server";
import { arrangeThoughts, tidyPaper } from "@/modules/drop/server";

const body = z.union([
  z.object({
    paperId: z.uuid(),
    placements: z
      .array(z.object({ id: z.string().regex(/^[a-z0-9-]{6,40}$/), x: z.number().min(-X_SHARE_LIMIT).max(X_SHARE_LIMIT).nullable(), y: z.number().min(-Y_LIMIT).max(Y_LIMIT).nullable() }))
      .min(1)
      .max(500),
  }),
  z.object({ paperId: z.uuid(), tidy: z.literal(true) }),
]);

/** Saves where thoughts were dragged on a paper, or tidies them all back into rows. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Couldn't save where that went. Try again." }, { status: 400 });
  const ed = await requireEditor(parsed.data.paperId);
  if (ed instanceof Response) return ed;
  const { paperId } = parsed.data;
  const tab = tabOf(request);
  if ("tidy" in parsed.data) {
    await tidyPaper(ed.ownerId, paperId, ed.user.id);
    await broadcast(paperId, { type: "sync" }, tab);
    return Response.json({ moved: "all" }, noStore);
  }
  const moved = await arrangeThoughts(ed.ownerId, paperId, parsed.data.placements, ed.user.id);
  if (moved) await broadcast(paperId, { type: "moved", placements: parsed.data.placements }, tab);
  return Response.json({ moved }, noStore);
}

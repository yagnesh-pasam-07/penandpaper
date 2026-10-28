import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { arrangeThoughts, tidyPaper } from "@/modules/drop/server";

const body = z.union([
  z.object({
    paperId: z.uuid(),
    placements: z
      .array(z.object({ id: z.string().regex(/^[a-z0-9-]{6,40}$/), x: z.number().min(-8).max(9), y: z.number().min(-20000).max(20000) }))
      .min(1)
      .max(500),
  }),
  z.object({ paperId: z.uuid(), tidy: z.literal(true) }),
]);

/** Saves where thoughts were dragged on a paper, or tidies them all back into rows. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Couldn't save where that went. Try again." }, { status: 400 });
  if ("tidy" in parsed.data) {
    await tidyPaper(user.id, parsed.data.paperId);
    return Response.json({ moved: "all" }, noStore);
  }
  return Response.json({ moved: await arrangeThoughts(user.id, parsed.data.paperId, parsed.data.placements) }, noStore);
}

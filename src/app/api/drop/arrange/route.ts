import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { arrangeThoughts, tidyToday } from "@/modules/drop/server";

const body = z.union([
  z.object({
    placements: z
      .array(z.object({ id: z.string().regex(/^[a-z0-9-]{6,40}$/), x: z.number().min(0).max(1), y: z.number().min(0).max(20000) }))
      .min(1)
      .max(500),
  }),
  z.object({ tidy: z.literal(true) }),
]);

/** Saves where thoughts were dragged on today's paper, or tidies them all back into rows. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Couldn't save where that went. Try again." }, { status: 400 });
  if ("tidy" in parsed.data) {
    await tidyToday(user.id);
    return Response.json({ moved: "all" }, noStore);
  }
  return Response.json({ moved: await arrangeThoughts(user.id, parsed.data.placements) }, noStore);
}

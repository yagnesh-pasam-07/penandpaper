import { z } from "zod";
import { PaperError } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { changePaper } from "@/modules/drop/server";

const id = z.string().regex(/^[a-z0-9-]{6,40}$/);

const op = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("schedule"), id, on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
  z.object({ kind: z.literal("ink"), thought: id, to: z.enum(["pen", "pencil"]) }),
]);

/** One change to today's paper: fold a thought till a day (schedule) or ink / pencil it. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = op.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That didn't come through. Try again." }, { status: 400 });
  try {
    return Response.json(await changePaper(user.id, parsed.data), noStore);
  } catch (e) {
    if (e instanceof PaperError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}

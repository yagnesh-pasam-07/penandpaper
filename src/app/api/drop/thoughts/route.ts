import { z } from "zod";
import { MAX_THOUGHT } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { addThought } from "@/modules/drop/server";

const body = z.object({
  id: z.string().regex(/^[a-z0-9-]{6,40}$/),
  text: z.string().trim().min(1).max(MAX_THOUGHT),
  shape: z.number().int().min(0).max(5),
  kind: z.enum(["pen", "pencil"]).default("pen"),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That thought didn't come through. Try again." }, { status: 400 });
  try {
    return Response.json(await addThought(user.id, parsed.data), noStore);
  } catch {
    return Response.json({ error: "Couldn't save that thought." }, { status: 409 });
  }
}

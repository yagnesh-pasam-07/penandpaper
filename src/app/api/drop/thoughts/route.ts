import { z } from "zod";
import { MAX_IMAGE, MAX_THOUGHT } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { addThought } from "@/modules/drop/server";

const body = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{6,40}$/),
    text: z.string().trim().max(MAX_THOUGHT),
    shape: z.number().int().min(0).max(5),
    kind: z.enum(["pen", "pencil"]).default("pen"),
    /** A picture, already shrunk in the browser. */
    image: z
      .string()
      .max(MAX_IMAGE)
      .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/)
      .nullable()
      .optional(),
    /** Where it was pasted on the sheet. */
    x: z.number().min(-8).max(9).nullable().optional(),
    y: z.number().min(-20000).max(20000).nullable().optional(),
  })
  // Words, a picture, or both.
  .refine((b) => b.text.length > 0 || !!b.image);

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

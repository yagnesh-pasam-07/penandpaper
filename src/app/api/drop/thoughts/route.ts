import { z } from "zod";
import { X_SHARE_LIMIT, Y_LIMIT } from "@/components/canvas/arrange";
import { MAX_IMAGE, MAX_THOUGHT } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { addThought, PaperNotFound } from "@/modules/drop/server";

const body = z
  .object({
    /** The paper it goes on. */
    paperId: z.uuid(),
    id: z.string().regex(/^[a-z0-9-]{6,40}$/),
    text: z.string().trim().max(MAX_THOUGHT),
    shape: z.number().int().min(0).max(5),
    /** A picture, already shrunk in the browser. */
    image: z
      .string()
      .max(MAX_IMAGE)
      .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/)
      .nullable()
      .optional(),
    /** Where it was pasted on the sheet. */
    x: z.number().min(-X_SHARE_LIMIT).max(X_SHARE_LIMIT).nullable().optional(),
    y: z.number().min(-Y_LIMIT).max(Y_LIMIT).nullable().optional(),
    /** "text": written straight on the paper with the Text tool (a drop, never a to-do). */
    kind: z.enum(["note", "text"]).optional(),
  })
  // Words, a picture, or both.
  .refine((b) => b.text.length > 0 || !!b.image);

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That thought didn't come through. Try again." }, { status: 400 });
  const { paperId, ...input } = parsed.data;
  try {
    return Response.json(await addThought(user.id, paperId, input), noStore);
  } catch (e) {
    if (e instanceof PaperNotFound) return Response.json({ error: "That paper isn't there any more." }, { status: 404 });
    return Response.json({ error: "Couldn't save that thought." }, { status: 409 });
  }
}

import { z } from "zod";
import { X_SHARE_LIMIT, Y_LIMIT } from "@/components/canvas/arrange";
import { MAX_IMAGE, MAX_THOUGHT } from "@/modules/drop/logic";
import { noStore, requireEditor } from "@/modules/drop/http";
import { broadcast, tabOf, thoughtEvent } from "@/modules/drop/live-server";
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
    kind: z.enum(["note", "text", "todo"]).optional(),
  })
  // Words, a picture, or both.
  .refine((b) => b.text.length > 0 || !!b.image);

/** Puts a thought on a paper: the owner's, or one shared with them to edit. Everyone with it open sees it at once. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That thought didn't come through. Try again." }, { status: 400 });
  const { paperId, ...input } = parsed.data;
  const ed = await requireEditor(paperId);
  if (ed instanceof Response) return ed;
  try {
    const thought = await addThought(ed.ownerId, paperId, input, ed.user.id);
    await broadcast(paperId, thoughtEvent(thought), tabOf(request));
    return Response.json(ed.ownerId === ed.user.id ? thought : { ...thought, dueAt: null, dueHasTime: false }, noStore);
  } catch (e) {
    if (e instanceof PaperNotFound) return Response.json({ error: "That paper isn't there any more." }, { status: 404 });
    return Response.json({ error: "Couldn't save that thought." }, { status: 409 });
  }
}

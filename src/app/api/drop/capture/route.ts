import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { captureText, isSameSite } from "@/modules/drop/share";
import { captureThought } from "@/modules/drop/server";

const body = z.object({
  // Made in the browser for each try, so sending it twice (a retry) is one note.
  id: z.string().regex(/^[a-z0-9-]{6,40}$/),
  text: z.string().max(20_000),
});

/** Saves a thought from the quick box (`/capture`) onto the paper touched last. Only this site's own page may send it. */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  const text = parsed.success ? captureText(parsed.data.text) : null;
  if (!parsed.success || !text) return Response.json({ error: "Write something first." }, { status: 400 });
  try {
    const done = await captureThought(user.id, { id: parsed.data.id, text });
    return Response.json({ paperId: done.paperId, paperName: done.paperName?.trim() || null }, noStore);
  } catch {
    return Response.json({ error: "Couldn't save that thought." }, { status: 409 });
  }
}

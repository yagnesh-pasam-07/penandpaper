import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { CANVAS_IDS, THEME_MODES } from "@/lib/canvases";
import { saveAppearance } from "@/modules/drop/server";

const body = z
  .object({ canvas: z.enum(CANVAS_IDS).optional(), theme: z.enum(THEME_MODES).optional() })
  .refine((p) => p.canvas !== undefined || p.theme !== undefined);

/** The canvas and theme choice. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nothing to change." }, { status: 400 });
  await saveAppearance(user.id, parsed.data);
  return Response.json({ ok: true }, noStore);
}

import { z } from "zod";
import { noStore, requireUser } from "@/modules/drop/http";
import { finishStackHint } from "@/modules/drop/server";

const body = z.object({ stackHint: z.literal("dismiss") });

/** One-time hints: dismissing one means it never shows again. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nothing to change." }, { status: 400 });
  await finishStackHint(user.id);
  return Response.json({ ok: true }, noStore);
}

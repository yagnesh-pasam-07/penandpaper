import { z } from "zod";
import { MAX_PAPER_NAME } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { createPaper, listPapers } from "@/modules/drop/server";

/** Their papers, newest first; `?archived=1` lists the ones put away instead. */
export async function GET(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return Response.json(await listPapers(user.id, { archived }), noStore);
}

const body = z.object({ name: z.string().max(MAX_PAPER_NAME * 2).nullable().optional() });

/** Makes a new blank paper; the name is optional. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = body.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return Response.json({ error: "That name didn't come through." }, { status: 400 });
  return Response.json(await createPaper(user.id, parsed.data.name), { ...noStore, status: 201 });
}

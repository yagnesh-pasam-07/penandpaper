import { noStore, requireUser } from "@/modules/drop/http";
import { getPaper } from "@/modules/drop/server";

export async function GET(_request: Request, ctx: RouteContext<"/api/drop/history/[date]">) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Not a date." }, { status: 400 });
  const paper = await getPaper(user.id, date);
  return paper ? Response.json(paper, noStore) : Response.json({ error: "No paper that day." }, { status: 404 });
}

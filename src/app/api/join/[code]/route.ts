import { withDb } from "@/db";
import { joinPreview } from "@/server/api";
import { currentUser } from "@/server/session";

export async function GET(_request: Request, ctx: RouteContext<"/api/join/[code]">) {
  const { code } = await ctx.params;
  const user = await currentUser();
  const preview = await withDb((db) => joinPreview(db, user, code));
  if (!preview) return Response.json({ error: "This invite link doesn't match a project." }, { status: 404 });
  return Response.json(preview, { headers: { "Cache-Control": "no-store" } });
}

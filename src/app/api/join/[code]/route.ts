import { withDb } from "@/db";
import { joinPreview } from "@/server/api";

export async function GET(_request: Request, ctx: RouteContext<"/api/join/[code]">) {
  const { code } = await ctx.params;
  const preview = await withDb((db) => joinPreview(db, code));
  if (!preview) return Response.json({ error: "This invite link doesn't match a project." }, { status: 404 });
  return Response.json(preview, { headers: { "Cache-Control": "no-store" } });
}

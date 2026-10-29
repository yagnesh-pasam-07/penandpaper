import { revokeApiToken } from "@/modules/drop/api-tokens";
import { noStore, requireUser } from "@/modules/drop/http";
import { isSameSite } from "@/modules/drop/share";

/** Revokes a token: it stops working at once and stays in the list. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/drop/tokens/[id]">) {
  if (request.headers.has("authorization") || !isSameSite(request.headers, new URL(request.url).origin)) {
    return Response.json({ error: "Not from this site." }, { status: 403 });
  }
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "No such token." }, { status: 404 });
  return (await revokeApiToken(user.id, id)) ? Response.json({ ok: true }, noStore) : Response.json({ error: "No such token." }, { status: 404 });
}

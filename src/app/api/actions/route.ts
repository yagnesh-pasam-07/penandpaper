import { withDb } from "@/db";
import { HttpError, anyAction, handleAction, stateFor } from "@/server/api";
import { currentUser } from "@/server/session";

/** Every change goes through here: { type, ...args } in, the new app state out. */
export async function POST(request: Request) {
  const parsed = anyAction.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "That request doesn't look right." }, { status: 400 });
  }
  try {
    const user = await currentUser();
    const body = await withDb(async (db) => {
      const result = await handleAction(db, user, parsed.data);
      return { ...result, state: await stateFor(db, user) };
    });
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error("action failed", parsed.data.type, e);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

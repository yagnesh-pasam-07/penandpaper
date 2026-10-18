import { withDb } from "@/db";
import { currentAccount } from "@/server/session";
import { stateFor } from "@/server/api";

export async function GET() {
  const state = await withDb(async (db) => stateFor(db, await currentAccount(db)));
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}

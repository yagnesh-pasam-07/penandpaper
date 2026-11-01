import { connection } from "next/server";
import { googleEnabled } from "@/lib/env";

/** `GET /api/stories/sign-in-methods`: which one-tap sign-ins are switched on, for the reader's sign-in sheet. */
export async function GET() {
  await connection();
  return Response.json({ google: googleEnabled }, { headers: { "Cache-Control": "no-store" } });
}

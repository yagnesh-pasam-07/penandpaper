import { noStore, requireUser } from "@/modules/drop/http";
import { clearDesk } from "@/modules/drop/server";

/** Stamps today's desk as cleared. The decisions themselves are saved as they're made. */
export async function POST() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return Response.json({ clearedAt: await clearDesk(user.id) }, noStore);
}

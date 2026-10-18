import { requireUser, noStore } from "@/modules/drop/http";
import { getToday } from "@/modules/drop/server";

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return Response.json(await getToday(user.id), noStore);
}

import { noStore, requireUser } from "@/modules/drop/http";
import { listHistory } from "@/modules/drop/server";

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return Response.json(await listHistory(user.id), noStore);
}

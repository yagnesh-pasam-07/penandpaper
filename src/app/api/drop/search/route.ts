import { noStore, requireUser } from "@/modules/drop/http";
import { searchTerm } from "@/modules/drop/logic";
import { searchThoughts } from "@/modules/drop/server";

/** Thoughts on any of their papers that contain `?q=` (any case): newest first, at most 50. */
export async function GET(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const term = searchTerm(new URL(request.url).searchParams.get("q"));
  return Response.json(term ? await searchThoughts(user.id, term) : [], noStore);
}

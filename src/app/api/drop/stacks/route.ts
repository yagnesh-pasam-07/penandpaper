import { z } from "zod";
import { MAX_NEXT_RANK, MAX_RANK, MAX_STACK_NAME, StackError } from "@/modules/drop/logic";
import { noStore, requireUser } from "@/modules/drop/http";
import { changeStacks } from "@/modules/drop/server";

const id = z.string().regex(/^[a-z0-9-]{6,40}$/);
const spot = { x: z.number().min(0).max(1).nullable(), y: z.number().min(-20000).max(20000).nullable() };

const op = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stack"), thought: id, onto: id, newStackId: id }),
  z.object({ kind: z.literal("takeOut"), thought: id, ...spot }),
  z.object({
    kind: z.literal("unstack"),
    stack: id,
    spots: z.array(z.object({ id, x: z.number().min(0).max(1), y: z.number().min(-20000).max(20000) })).max(500),
  }),
  z.object({ kind: z.literal("rename"), stack: id, name: z.string().max(MAX_STACK_NAME * 2).nullable() }),
  z.object({ kind: z.literal("crumple"), stack: id }),
  z.object({ kind: z.literal("schedule"), id, on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
  z.object({ kind: z.literal("ink"), thought: id, to: z.enum(["pen", "pencil"]) }),
  z.object({ kind: z.literal("rank"), id, rank: z.number().int().min(1).max(MAX_RANK).nullable() }),
  z.object({ kind: z.literal("order"), ids: z.array(id).max(MAX_RANK) }),
  z.object({ kind: z.literal("nextRank"), ids: z.array(id).max(MAX_NEXT_RANK) }),
]);

/** One change to today's paper: stack, take out, unstack, rename, crumple, fold (schedule) or ink. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = op.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That didn't come through. Try again." }, { status: 400 });
  try {
    return Response.json(await changeStacks(user.id, parsed.data), noStore);
  } catch (e) {
    if (e instanceof StackError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}

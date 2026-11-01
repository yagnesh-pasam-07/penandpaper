import { isSameSite } from "@/modules/drop/share";
import { storyWriter } from "@/modules/stories/guard";
import { PART_CHARS, putMediaPart } from "@/modules/stories/server";

/** `PUT /studio/stories/upload/<id>?n=2`: one part of a file, as base64 text. */
export async function PUT(request: Request, ctx: RouteContext<"/studio/stories/upload/[id]">) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  if (!(await storyWriter())) return Response.json({ error: "Only the writer can do that." }, { status: 403 });
  const { id } = await ctx.params;
  const n = Number(new URL(request.url).searchParams.get("n"));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(n)) return Response.json({ error: "Bad part." }, { status: 400 });
  const data = await request.text();
  if (data.length > PART_CHARS || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return Response.json({ error: "Bad part." }, { status: 400 });
  const done = await putMediaPart(id, n, data);
  return done ? Response.json(done) : Response.json({ error: "No such file." }, { status: 404 });
}

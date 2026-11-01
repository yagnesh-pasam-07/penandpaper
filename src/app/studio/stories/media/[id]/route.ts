import { storyWriter } from "@/modules/stories/guard";
import { findMedia, sendMedia } from "@/modules/stories/media-response";

/** `GET /studio/stories/media/<id>`: any story file, drafts included, for the writer's editor and preview. */
export async function GET(request: Request, ctx: RouteContext<"/studio/stories/media/[id]">) {
  if (!(await storyWriter())) return new Response("Not found", { status: 404 });
  const meta = await findMedia((await ctx.params).id);
  if (meta instanceof Response) return meta;
  return sendMedia(request, meta, "private, max-age=3600");
}

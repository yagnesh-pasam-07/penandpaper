import { findMedia, sendMedia } from "@/modules/stories/media-response";
import { mediaIsPublic } from "@/modules/stories/server";

/**
 * `GET /api/stories/media/<id>[?w=960]`: a picture or recording from a
 * published story, for anyone. A file's id never changes what it holds, so it
 * is cached for a year. Files of drafts and scheduled stories are not found
 * here (the writer previews them through /studio/stories/media).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/stories/media/[id]">) {
  const meta = await findMedia((await ctx.params).id);
  if (meta instanceof Response) return meta;
  if (!(await mediaIsPublic(meta.storyId, meta.id))) return new Response("Not found", { status: 404 });
  return sendMedia(request, meta, "public, max-age=31536000, immutable");
}

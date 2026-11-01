import { z } from "zod";
import { isSameSite } from "@/modules/drop/share";
import { storyWriter } from "@/modules/stories/guard";
import { MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, PART_CHARS, startMedia, storyForWriter } from "@/modules/stories/server";

const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/gif"];
const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm"];

const body = z.object({
  storyId: z.uuid(),
  kind: z.enum(["image", "audio"]),
  contentType: z.string().max(60),
  size: z.number().int().positive(),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

/**
 * `POST /studio/stories/upload`: starts a file for a story and says how many
 * parts to send (each `PUT /studio/stories/upload/<id>?n=`). The writer only,
 * from this site only.
 */
export async function POST(request: Request) {
  if (!isSameSite(request.headers, new URL(request.url).origin)) return Response.json({ error: "Not from this site." }, { status: 403 });
  if (!(await storyWriter())) return Response.json({ error: "Only the writer can do that." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That file can't be added." }, { status: 400 });
  const m = parsed.data;
  const image = m.kind === "image";
  if (!(image ? IMAGE_TYPES : AUDIO_TYPES).includes(m.contentType)) return Response.json({ error: image ? "Use a JPG, PNG, WebP or GIF." : "Use an MP3, M4A, WAV, OGG or WebM recording." }, { status: 415 });
  if (m.size > (image ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES)) return Response.json({ error: image ? "That picture is over 3 MB after shrinking." : "That recording is over 40 MB." }, { status: 413 });
  if (!(await storyForWriter(m.storyId))) return Response.json({ error: "No such story." }, { status: 404 });
  const parts = Math.max(1, Math.ceil(m.size / ((PART_CHARS / 4) * 3)));
  const id = await startMedia(m.storyId, { ...m, parts });
  return Response.json({ id, parts, partBytes: (PART_CHARS / 4) * 3 });
}

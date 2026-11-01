import "server-only";
import sharp from "sharp";
import { mediaBytes, mediaMeta, PART_CHARS, type MediaMeta } from "./server";

/** Bytes per stored part (base64 grows by 4/3). */
export const PART_BYTES = (PART_CHARS / 4) * 3;

/** Widths a picture is offered at, so a phone on slow 4G gets a small one. */
export const WIDTHS = [480, 960, 1600] as const;

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Sends one story file. Pictures can be asked for at a width from WIDTHS
 * (`?w=`) and come back as WebP. Audio answers Range requests (206), which
 * iPhone Safari needs to seek and to keep playing with the screen locked.
 */
export async function sendMedia(request: Request, meta: MediaMeta, cache: string): Promise<Response> {
  const headers = new Headers({ "Cache-Control": cache, "X-Content-Type-Options": "nosniff", "Accept-Ranges": meta.kind === "audio" ? "bytes" : "none" });

  if (meta.kind === "image") {
    const w = Number(new URL(request.url).searchParams.get("w"));
    let bytes = await mediaBytes(meta.id);
    let type = meta.contentType;
    if ((WIDTHS as readonly number[]).includes(w) && meta.width && meta.width > w) {
      bytes = await sharp(bytes).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      type = "image/webp";
    }
    headers.set("Content-Type", type);
    headers.set("Content-Length", String(bytes.length));
    return new Response(new Uint8Array(bytes), { headers });
  }

  headers.set("Content-Type", meta.contentType);
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!range) {
    const bytes = await mediaBytes(meta.id);
    headers.set("Content-Length", String(bytes.length));
    return new Response(new Uint8Array(bytes), { headers });
  }
  const size = meta.size;
  let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  let end = range[1] && range[2] ? Number(range[2]) : size - 1;
  // At most one part per answer: the player asks again for the rest.
  end = Math.min(end, size - 1, start + PART_BYTES - 1);
  if (!range[1] && !range[2]) start = 0;
  if (start >= size || start > end) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const first = Math.floor(start / PART_BYTES);
  const last = Math.floor(end / PART_BYTES);
  const chunk = await mediaBytes(meta.id, first, last);
  const offset = start - first * PART_BYTES;
  const body = chunk.subarray(offset, offset + (end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${start + body.length - 1}/${size}`);
  headers.set("Content-Length", String(body.length));
  return new Response(new Uint8Array(body), { status: 206, headers });
}

/** The file's details by id, or a 404 to return. */
export async function findMedia(id: string): Promise<MediaMeta | Response> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const meta = await mediaMeta(id).catch(() => null);
  return meta ?? notFound();
}

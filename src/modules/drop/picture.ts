import "server-only";
import sharp from "sharp";
import { MAX_IMAGE } from "./logic";
import { loadPicture } from "./preview";
import { netDeps } from "./preview-net";

/** The long side, once shrunk: the same as a picture pasted in the browser (see image.ts). */
const LONG_SIDE = 1280;

/**
 * A picture from the web, kept on the note as a small WebP data URL, or null if
 * it can't be had: an unsafe or private address, not a picture, too slow, or
 * too big even when shrunk. The server fetches it (the extension can't read
 * another site's pictures), never with the visitor's cookies.
 */
export async function pictureFromUrl(url: string): Promise<string | null> {
  const got = await loadPicture(url, netDeps);
  if (!got.ok) return null;
  try {
    const img = sharp(got.bytes, { animated: false, limitInputPixels: 40_000_000 }).rotate().resize(LONG_SIDE, LONG_SIDE, { fit: "inside", withoutEnlargement: true });
    for (const quality of [82, 70, 55, 40]) {
      const out = await img.clone().webp({ quality }).toBuffer();
      const dataUrl = `data:image/webp;base64,${out.toString("base64")}`;
      if (dataUrl.length <= MAX_IMAGE) return dataUrl;
    }
  } catch {
    // Not a picture after all, or one sharp can't read.
  }
  return null;
}

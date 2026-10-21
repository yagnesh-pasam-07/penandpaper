"use client";

import { MAX_IMAGE } from "./logic";

/** Pictures bigger than this aren't taken at all. */
export const MAX_IMAGE_FILE = 10 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
/** The long side, once shrunk: plenty for a note, small enough to save with it. */
const LONG_SIDE = 1280;

export type Picture = { url: string; w: number; h: number };

/** The image files in a paste or a drop, if any. */
export function imageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = [...data.files].filter((f) => TYPES.includes(f.type));
  if (files.length) return files;
  // Some browsers only put a pasted screenshot in `items`.
  return [...data.items].flatMap((it) => (it.kind === "file" && TYPES.includes(it.type) ? [it.getAsFile()].filter((f): f is File => !!f) : []));
}

/** Whether a drag carries files (so the sheet can say "let go to pin it"). */
export function draggingFiles(data: DataTransfer | null): boolean {
  return !!data && [...data.types].includes("Files");
}

/**
 * Shrinks a picture to at most 1280px on its long side, as a WebP (JPEG where
 * WebP isn't made) data URL, stepping the quality down until it fits.
 */
export async function shrinkImage(file: File): Promise<Picture> {
  if (!TYPES.includes(file.type)) throw new Error("That isn't a PNG, JPG, GIF or WebP.");
  if (file.size > MAX_IMAGE_FILE) throw new Error("That picture is over 10 MB.");
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that picture.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    let url = canvas.toDataURL("image/webp", quality);
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_IMAGE) return { url, w: width, h: height };
  }
  throw new Error("That picture is too big to keep.");
}

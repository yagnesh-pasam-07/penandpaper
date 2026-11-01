"use client";

/** Files from the writer's computer into a story: pictures shrunk first, recordings sent in parts. */

const LONG_SIDE = 2000;

/** A picture shrunk to 2000px on its long side as WebP (JPEG where WebP isn't made), with its size. */
async function shrink(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  if (file.type === "image/gif") {
    const bmp = await createImageBitmap(file);
    const out = { blob: file as Blob, w: bmp.width, h: bmp.height };
    bmp.close();
    return out;
  }
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, LONG_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  for (const q of [0.86, 0.78, 0.68]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", q));
    const ok = blob && blob.type === "image/webp" ? blob : await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (ok && ok.size <= 3 * 1024 * 1024) return { blob: ok, w, h };
  }
  throw new Error("That picture is too big, even shrunk.");
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function send(storyId: string, kind: "image" | "audio", blob: Blob, extra: { width?: number; height?: number }, onProgress?: (p: number) => void): Promise<string> {
  const start = await fetch("/studio/stories/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId, kind, contentType: blob.type, size: blob.size, ...extra }) });
  const meta = (await start.json().catch(() => ({}))) as { id?: string; parts?: number; partBytes?: number; error?: string };
  if (!start.ok || !meta.id || !meta.parts || !meta.partBytes) throw new Error(meta.error ?? "That file couldn't be added.");
  for (let n = 0; n < meta.parts; n++) {
    const part = await blob.slice(n * meta.partBytes, (n + 1) * meta.partBytes).arrayBuffer();
    const res = await fetch(`/studio/stories/upload/${meta.id}?n=${n}`, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: toBase64(part) });
    if (!res.ok) throw new Error("The upload stopped. Try again.");
    onProgress?.((n + 1) / meta.parts);
  }
  return meta.id;
}

export async function uploadImage(storyId: string, file: File): Promise<{ id: string; w: number; h: number }> {
  const { blob, w, h } = await shrink(file);
  return { id: await send(storyId, "image", blob, { width: w, height: h }), w, h };
}

/** A recording's length in seconds, read by the browser. */
function lengthOf(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(file);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : null);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    a.src = url;
  });
}

export async function uploadAudio(storyId: string, file: File, onProgress?: (p: number) => void): Promise<{ id: string; duration: number | null }> {
  const duration = await lengthOf(file);
  const type = file.type || (file.name.endsWith(".m4a") ? "audio/mp4" : file.name.endsWith(".mp3") ? "audio/mpeg" : "");
  const blob = type === file.type ? file : new Blob([file], { type });
  return { id: await send(storyId, "audio", blob, {}, onProgress), duration };
}

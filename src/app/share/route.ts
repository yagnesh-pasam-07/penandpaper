import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_IMAGE } from "@/modules/drop/logic";
import { buildShareText, pictureDataUrl, shareId, shareQuery, SHARE_IMAGE_TYPES, type ShareFields } from "@/modules/drop/share";
import { captureTarget, captureThought } from "@/modules/drop/server";
import { currentUser } from "@/server/session";

/**
 * The target of "Share to Pen & Paper" from a phone (see src/app/manifest.ts):
 * a link, some text or a picture lands on the paper touched last.
 *
 * A GET that saves something could be set off by any other website, so a share
 * is only saved straight away when it comes from the browser or the OS itself
 * (Sec-Fetch-Site: none) or from this site (same-origin: the sign-in coming back,
 * or the confirmation page below). Anything else, and any request that doesn't
 * say, gets a one-tap confirmation first.
 */

const fields = z.object({
  title: z.string().max(4000).optional(),
  text: z.string().max(4000).optional(),
  url: z.string().max(4000).optional(),
});

const html = (body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Pen &amp; Paper</title><style>
:root{color-scheme:light dark;--bg:#faf8f3;--sheet:#fff;--ink:#1d1c1a;--mute:#6d6a63;--line:#e6e1d7;--red:#c0392b}
@media(prefers-color-scheme:dark){:root{--bg:#151412;--sheet:#1e1d1a;--ink:#ece9e2;--mute:#a29e94;--line:#34312c;--red:#e07a6b}}
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{width:min(440px,calc(100% - 32px));background:var(--sheet);border:1px solid var(--line);border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:14px}
h1{margin:0;font-size:20px}p{margin:0;color:var(--mute)}blockquote{margin:0;padding:10px 12px;border-left:3px solid var(--red);background:var(--bg);border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:40dvh;overflow:auto}
.row{display:flex;gap:10px}button,a.b{flex:1;text-align:center;font:inherit;font-weight:600;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);text-decoration:none;cursor:pointer}
button.p{background:var(--red);border-color:var(--red);color:#fff}
</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The share sheet's fields from a query string or a form. */
function read(source: URLSearchParams | FormData): ShareFields {
  const get = (k: string) => {
    const v = source.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = fields.safeParse({ title: get("title"), text: get("text"), url: get("url") });
  return parsed.success ? parsed.data : {};
}

async function handle(request: Request, shared: ShareFields, file: File | null): Promise<Response> {
  // A browser warming a link up must not add anything.
  if ((request.headers.get("sec-purpose") ?? "").includes("prefetch")) return new NextResponse(null, { status: 204 });

  const origin = new URL(request.url).origin;
  const user = await currentUser();
  if (!user) {
    // Sign in, then come back to the same share (a picture can't make the trip; the words do).
    const back = `/share?${shareQuery(shared)}`;
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(back)}`, origin), 303);
  }

  const text = buildShareText(shared);
  let image: string | null = null;
  let skippedImage = false;
  if (file && file.size > 0) {
    if ((SHARE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      image = file.size <= MAX_IMAGE ? pictureDataUrl(file.type, new Uint8Array(await file.arrayBuffer()), MAX_IMAGE) : null;
    }
    skippedImage = !image;
  }
  if (!text && !image) {
    return html(
      `<h1>Nothing to add</h1><p>${skippedImage ? "That picture is too big, or isn't a PNG, JPG, GIF or WebP. Open Pen &amp; Paper and drop it there; it shrinks it first." : "The share had no words, link or picture."}</p><div class="row"><a class="b" href="/drop">Open my paper</a></div>`,
      400,
    );
  }

  const site = request.headers.get("sec-fetch-site");
  const direct = site === "none" || site === "same-origin";
  if (!direct) {
    const target = await captureTarget(user.id);
    const where = target.paperName?.trim() ? `“${esc(target.paperName.trim())}”` : "your latest paper";
    return html(
      `<h1>Add to ${where}?</h1><blockquote>${esc(text || "A picture")}</blockquote>${skippedImage || image ? "<p>Pictures can't be added from this screen. Share it again from the app, or drop it on the paper.</p>" : ""}
<form method="post" action="/share" class="row"><input type="hidden" name="title" value="${esc(shared.title ?? "")}"><input type="hidden" name="text" value="${esc(shared.text ?? "")}"><input type="hidden" name="url" value="${esc(shared.url ?? "")}"><a class="b" href="/drop">Cancel</a><button class="p" type="submit"${text ? "" : " disabled"}>Add</button></form>`,
    );
  }

  const done = await captureThought(user.id, { id: shareId(user.id, text, image), text, image });
  const to = new URL(`/drop/${done.paperId}`, origin);
  to.searchParams.set("note", done.thought.id);
  if (skippedImage) to.searchParams.set("skipped", "image");
  return NextResponse.redirect(to, 303);
}

export async function GET(request: Request) {
  return handle(request, read(new URL(request.url).searchParams), null);
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return html(`<h1>That didn't come through</h1><p>Try sharing it again.</p><div class="row"><a class="b" href="/drop">Open my paper</a></div>`, 400);
  const picture = form.get("image");
  return handle(request, read(form), picture instanceof File ? picture : null);
}

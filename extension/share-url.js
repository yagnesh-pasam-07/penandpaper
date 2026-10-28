// Pure helpers for the extension: which server to talk to, and the address of
// the little window that saves a note. No browser APIs, so vitest can run it.

export const DEFAULT_SERVER = "https://penandpaper-app.vercel.app";
export const LOCAL_SERVER = "http://localhost:3000";

/** The site refuses fields longer than 4000 characters, so stay well inside. */
const FIELD_MAX = 3900;

/**
 * The server as an origin ("https://host[:port]"), or null if it isn't usable.
 * Only https is accepted, plus http for this computer (localhost / 127.0.0.1).
 */
export function normalizeServer(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol === "https:" || (u.protocol === "http:" && local)) return u.origin;
  return null;
}

/** A web address (http or https) exactly as given, or "". */
function webUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /\s/.test(raw)) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? raw : "";
  } catch {
    return "";
  }
}

const cut = (value) => String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, FIELD_MAX);

/**
 * What to save, from what the browser knows.
 *   kind: "page" | "selection" | "link" | "image"
 *   tab:  { title, url } of the page it happened on
 *   info: { selectionText, linkUrl, srcUrl } from the context menu (all optional)
 *   selection: the page's selected text when the toolbar button or shortcut was used
 */
export function pickShare(kind, tab = {}, info = {}, selection = "") {
  const title = cut(tab.title);
  const page = webUrl(tab.url);
  switch (kind) {
    case "selection":
      return { title, text: cut(info.selectionText || selection), url: page };
    case "link":
      return { title: "", text: "", url: webUrl(info.linkUrl) };
    case "image": {
      // A picture on the page is saved by its address; an inline one (data:) has none, so the page stands in.
      const src = webUrl(info.srcUrl);
      return src ? { title: "", text: "", url: src } : { title, text: "", url: page };
    }
    default:
      return { title, text: cut(selection), url: page };
  }
}

/** The address of the small quick-thought box: `<server>/capture?from=ext`. */
export function buildCaptureUrl(server) {
  return `${normalizeServer(server) ?? DEFAULT_SERVER}/capture?from=ext`;
}

/** The address of the little window that saves a note: `<server>/share?…&from=ext`. */
export function buildShareUrl(server, fields = {}) {
  const origin = normalizeServer(server) ?? DEFAULT_SERVER;
  const q = new URLSearchParams();
  const title = cut(fields.title);
  const text = cut(fields.text);
  const url = webUrl(fields.url);
  if (title) q.set("title", title);
  if (text) q.set("text", text);
  // An address cut short is a different address, so one that is too long is left out whole.
  if (url && url.length <= FIELD_MAX) q.set("url", url);
  q.set("from", "ext");
  return `${origin}/share?${q.toString()}`;
}

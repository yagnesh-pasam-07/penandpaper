// Pure helpers for saving a thought straight from the extension (the in-page
// box and the quick "save this page"): what to send, which way to show it, and
// what to say about the answer. No browser APIs, so vitest can run it.

import { DEFAULT_SERVER, normalizeServer } from "./share-url.js";

/** The site keeps a thought to this many characters. */
export const MAX_THOUGHT = 1000;

/** The ids the site accepts are 6 to 40 of a-z, 0-9 and "-": "ext-" and a uuid is exactly 40. */
export function newThoughtId(uuid = () => crypto.randomUUID()) {
  return `ext-${String(uuid()).toLowerCase()}`.slice(0, 40);
}

/** `<server>/api/drop/capture`, the address a thought is sent to. */
export function captureEndpoint(server) {
  return `${normalizeServer(server) ?? DEFAULT_SERVER}/api/drop/capture`;
}

/** Where to send someone who isn't signed in: the log-in page, which comes back to the quick box. */
export function loginUrl(server) {
  return `${normalizeServer(server) ?? DEFAULT_SERVER}/login?next=/capture`;
}

const clean = (value) => String(value ?? "").replace(/\r\n?/g, "\n").trim();

/**
 * One thought from a page: its title, the selected words and the address, each
 * on its own line, leaving out what repeats. The same rule the site's `/share`
 * uses for a share, so a saved page reads the same either way.
 */
export function buildCaptureText({ title = "", text = "", url = "" } = {}) {
  const t = clean(title);
  const x = clean(text);
  const u = clean(url);
  const lines = [];
  if (t && t !== x && !x.includes(t)) lines.push(t);
  if (x) lines.push(x);
  if (u && !x.includes(u) && !t.includes(u)) lines.push(u);
  return lines.join("\n").slice(0, MAX_THOUGHT).trim();
}

/** A web address (http or https) exactly as given, or "". */
function httpUrl(value) {
  const raw = clean(value);
  if (!raw || /\s/.test(raw)) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? raw : "";
  } catch {
    return "";
  }
}

/**
 * A typed thought with the page it was typed on ("Attach this page"): the words
 * first, then the page's title and address, leaving out what repeats. The
 * address is kept whole; if it doesn't all fit, the typed words give way.
 */
export function withPage(text, page = {}) {
  const words = clean(text);
  const title = clean(page.title);
  const url = httpUrl(page.url);
  const tail = [];
  if (title && !words.includes(title)) tail.push(title);
  if (url && !words.includes(url) && !title.includes(url)) tail.push(url);
  if (!tail.length) return words.slice(0, MAX_THOUGHT).trim();
  const tailText = tail.join("\n");
  const room = Math.max(0, MAX_THOUGHT - tailText.length - 1);
  const head = words.slice(0, room).trim();
  return (head ? `${head}\n${tailText}` : tailText).slice(0, MAX_THOUGHT).trim();
}

/** What to tell someone whose thought is safe on this device but not on the site yet. */
export function queuedMessage(status) {
  return status === 401 ? "Saved on this device. Sign in to sync." : "Saved on this device, will sync.";
}

// Pages a browser won't let an extension put anything into.
const BLOCKED_HOSTS = new Set(["chromewebstore.google.com", "microsoftedge.microsoft.com"]);

/**
 * Whether the box can be drawn on this page. Browser pages (chrome://, about:,
 * view-source:), the extension stores, the PDF viewer and file:// pages refuse
 * scripts, so those get the small window instead.
 */
export function canInject(url) {
  let u;
  try {
    u = new URL(String(url ?? ""));
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (BLOCKED_HOSTS.has(u.hostname)) return false;
  if (u.hostname === "chrome.google.com" && u.pathname.startsWith("/webstore")) return false;
  if (u.pathname.toLowerCase().endsWith(".pdf")) return false;
  return true;
}

/**
 * "overlay" (the box on the page) or "window" (the small separate window).
 * When the shortcut is pressed while another app is in front (a Global
 * shortcut), the page isn't on screen, so the box has to be a window, which
 * the browser brings to the front.
 */
export function chooseSurface({ mode, url, chromeFocused = true }) {
  return mode === "window" || !canInject(url) || !chromeFocused ? "window" : "overlay";
}

/** What happened to a save, as the box should say it. `status` 0 means the request never got an answer. */
export function saveOutcome(status, body = {}) {
  if (status >= 200 && status < 300) return { kind: "saved", message: `Saved to ${String(body?.paperName ?? "").trim() || "your paper"}` };
  if (status === 401) return { kind: "signin", message: "Sign in, then try again." };
  if (status === 403) return { kind: "error", message: "The site didn't accept that. Reload the extension and try again." };
  if (status === 400) return { kind: "error", message: String(body?.error ?? "") || "Write something first." };
  if (status === 0) return { kind: "error", message: "Couldn't reach Pen & Paper. Check your connection." };
  return { kind: "error", message: "Couldn't save that. Try again." };
}

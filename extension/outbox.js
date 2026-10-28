// The outbox: thoughts typed in the box are kept on this device until the site
// has them, so a dropped connection, a signed-out browser or a server hiccup
// never loses a thought. Pure functions over a plain list (the worker keeps the
// list in chrome.storage.local), so vitest can run them.

export const OUTBOX_KEY = "outbox";
/** More than this and the oldest waiting thought is dropped to make room. */
export const MAX_OUTBOX = 200;

const FIRST_RETRY_MS = 30_000;
const LONGEST_WAIT_MS = 60 * 60_000;

/** How long to wait before the next try, after `attempts` failures (30 s, 1 min, 2 min … up to an hour). */
export function backoffMs(attempts) {
  const n = Math.max(1, Math.floor(attempts) || 1);
  return Math.min(FIRST_RETRY_MS * 2 ** (n - 1), LONGEST_WAIT_MS);
}

/** Adds a thought (once: the same id is not added twice), ready to send now. */
export function enqueue(list, item, now = Date.now()) {
  if (list.some((x) => x.id === item.id)) return list;
  const next = [...list, { id: item.id, text: item.text, createdAt: now, attempts: 0, nextAt: 0 }];
  return next.length > MAX_OUTBOX ? next.slice(next.length - MAX_OUTBOX) : next;
}

export function remove(list, id) {
  return list.some((x) => x.id === id) ? list.filter((x) => x.id !== id) : list;
}

/** What is due to be tried, oldest first. `force` is an id to try even if its wait isn't over. */
export function dueItems(list, now = Date.now(), force = null) {
  return list.filter((x) => x.id === force || x.nextAt <= now).sort((a, b) => a.createdAt - b.createdAt);
}

/** A failed try: one more attempt counted and the next one pushed back. */
export function failed(list, id, now = Date.now()) {
  return list.map((x) => (x.id === id ? { ...x, attempts: x.attempts + 1, nextAt: now + backoffMs(x.attempts + 1) } : x));
}

/**
 * Whether a failed save is worth trying again. No answer at all (0), signed out
 * (401), refused for now (403, 408, 429) and a broken server (5xx) are; a
 * thought the site says it can never take (400 and the like) is not.
 */
export function retryable(status) {
  return status === 0 || status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
}

/** What a typed-but-unsent box leaves behind for next time: its words, or nothing. */
export function keptDraft(text) {
  const t = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  return t || "";
}

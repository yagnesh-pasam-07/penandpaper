import { buildCaptureText, captureEndpoint, chooseSurface, loginUrl, newThoughtId, pictureUrl, queuedMessage, saveOutcome, withPage } from "./capture.js";
import { dueItems, enqueue, failed, OUTBOX_KEY, remove, retryable } from "./outbox.js";
import { buildCaptureUrl, buildShareUrl, DEFAULT_SERVER, pickShare } from "./share-url.js";

// The small separate window: the fallback for pages that can't hold the box or
// the note, and anyone who picked "a separate window" in Options.
const WINDOW = { type: "popup", width: 420, height: 340, focused: true };
const QUICK_WINDOW = { type: "popup", width: 520, height: 300, focused: true };

const MENU = [
  { id: "page", title: "Save page to Pen & Paper", contexts: ["page"] },
  { id: "selection", title: "Save selection to Pen & Paper", contexts: ["selection"] },
  { id: "link", title: "Save link to Pen & Paper", contexts: ["link"] },
  { id: "image", title: "Save image to Pen & Paper", contexts: ["image"] },
];

async function settings() {
  const { server, mode } = await chrome.storage.sync.get(["server", "mode"]);
  return { server: server || DEFAULT_SERVER, mode: mode === "window" ? "window" : "overlay" };
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function openShareWindow(fields) {
  await chrome.windows.create({ ...WINDOW, url: buildShareUrl((await settings()).server, fields) });
}

async function openQuickWindow() {
  await chrome.windows.create({ ...QUICK_WINDOW, url: buildCaptureUrl((await settings()).server) });
}

/**
 * What is highlighted on the page, if the browser lets the extension read it:
 * the words, and the address of the first picture inside the highlight (a post
 * with its photo, say).
 */
async function selectionOf(tab) {
  if (!tab?.id) return { text: "", image: "" };
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = getSelection();
        const text = String(sel ?? "");
        let image = "";
        if (sel && sel.rangeCount && !sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          for (const img of document.images) {
            // Big enough to be the picture, not an icon or an avatar.
            if (range.intersectsNode(img) && img.naturalWidth >= 64 && img.naturalHeight >= 64) {
              image = img.currentSrc || img.src;
              break;
            }
          }
        }
        return { text, image };
      },
    });
    return { text: String(result?.result?.text ?? ""), image: String(result?.result?.image ?? "") };
  } catch {
    return { text: "", image: "" };
  }
}

/** Draws the box (or a note) on the page. Throws if the page won't take scripts. */
async function onPage(tab, run, args = []) {
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["overlay.js"] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: run, args });
}

/* ---------- The outbox: nothing typed is lost ---------- */

async function readOutbox() {
  const stored = await chrome.storage.local.get(OUTBOX_KEY);
  return Array.isArray(stored[OUTBOX_KEY]) ? stored[OUTBOX_KEY] : [];
}

const writeOutbox = (list) => chrome.storage.local.set({ [OUTBOX_KEY]: list });

// One thing touches the outbox at a time, so two saves can't overwrite each other.
let queue = Promise.resolve();
const exclusively = (task) => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

/** One try at sending one thought: the status (0 if there was no answer) and what the site said. */
async function send(item) {
  const { server } = await settings();
  try {
    const res = await fetch(captureEndpoint(server), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, text: item.text, ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}) }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } catch {
    return { status: 0, body: {} };
  }
}

/**
 * Tries what is due. The site accepts a request from this extension only when
 * you are signed in; not signed in, the thought waits here and the log-in page
 * opens (only when you just saved it yourself, never from a background retry).
 * `force` is the thought you just saved, tried even if its wait isn't over.
 * Returns what happened to that one thought.
 */
function flush(force = null) {
  return exclusively(async () => {
    let list = await readOutbox();
    let mine = null;
    let signedOut = false;
    for (const item of dueItems(list, Date.now(), force)) {
      if (signedOut && item.id !== force) continue;
      const { status, body } = await send(item);
      if (status >= 200 && status < 300) {
        list = remove(list, item.id);
        const paper = { id: body.paperId ?? null, name: String(body.paperName ?? "").trim() || null };
        await chrome.storage.local.set({ paper });
        if (item.id === force) mine = { kind: "saved", ...saveOutcome(status, body), paperId: paper.id };
      } else if (!retryable(status)) {
        list = remove(list, item.id);
        if (item.id === force) mine = saveOutcome(status, body);
      } else {
        list = failed(list, item.id, Date.now());
        if (status === 401) signedOut = true;
        if (item.id === force) mine = { kind: "queued", message: queuedMessage(status), status };
      }
    }
    await writeOutbox(list);
    return mine;
  });
}

/** A thought from the box or the toolbar: kept on this device first, then sent. `imageUrl` is a picture for the site to fetch and keep with it. */
async function capture({ id, text, imageUrl = "" }) {
  await exclusively(async () => writeOutbox(enqueue(await readOutbox(), { id, text, imageUrl }, Date.now())));
  const out = (await flush(id)) ?? { kind: "queued", message: queuedMessage(0) };
  if (out.status === 401) await chrome.tabs.create({ url: loginUrl((await settings()).server) });
  return out;
}

/** Takes a thought back: out of the outbox if it hasn't gone yet, else crumpled on the paper. */
async function undo({ id, paperId }) {
  const waiting = await exclusively(async () => {
    const list = await readOutbox();
    if (!list.some((x) => x.id === id)) return false;
    await writeOutbox(remove(list, id));
    return true;
  });
  if (waiting) return { ok: true };
  if (!paperId) return { ok: false, message: "Couldn't undo that." };
  const { server } = await settings();
  try {
    const res = await fetch(`${new URL(captureEndpoint(server)).origin}/api/drop/thoughts/${encodeURIComponent(id)}?paper=${encodeURIComponent(paperId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    // 404: it was already gone, which is what undo wanted.
    return res.status === 204 || res.status === 404 ? { ok: true } : { ok: false, message: "Couldn't undo that. Open the paper to remove it." };
  } catch {
    return { ok: false, message: "Couldn't reach Pen & Paper to undo that." };
  }
}

/* ---------- Events ---------- */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU) chrome.contextMenus.create(item);
  });
  void flush();
});

// What was left waiting is tried again when the browser starts and when the network comes back.
chrome.runtime.onStartup.addListener(() => void flush());
self.addEventListener("online", () => void flush());

// Messages from the box on the page: only this extension's own scripts.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === "pp:capture") {
    const { id, text, page } = message;
    if (typeof id !== "string" || !/^[a-z0-9-]{6,40}$/.test(id) || typeof text !== "string" || !text.trim()) {
      sendResponse(saveOutcome(400));
      return false;
    }
    const full = page && typeof page === "object" ? withPage(text, page) : withPage(text);
    capture({ id, text: full }).then(sendResponse);
    return true;
  }
  if (message?.type === "pp:undo") {
    undo({ id: String(message.id ?? ""), paperId: message.paperId ? String(message.paperId) : "" }).then(sendResponse);
    return true;
  }
  return false;
});

/**
 * Saves straight to the paper and says so with a note on the page (no window):
 * the words (title, highlight, address) and, when there is one, a picture the
 * site fetches and keeps. Falls back to the small window where the page won't
 * take the note; the window can't carry a picture, so then only the words go.
 */
async function saveFromPage(tab, share, picture = "", fallback = share) {
  const { mode } = await settings();
  const imageUrl = pictureUrl(picture);
  const text = buildCaptureText(share);
  if ((text || imageUrl) && chooseSurface({ mode, url: tab?.url }) === "overlay") {
    const toast = (message, tone, u = null) => onPage(tab, (m, t, x) => window.__ppQuick.toast(m, t, x), [message, tone, u]);
    try {
      // Fetching a picture takes a moment, so say something now.
      if (imageUrl) await toast("Saving…", "ok");
      const id = newThoughtId();
      const out = await capture({ id, text, imageUrl });
      const undo = out.kind === "saved" ? { id, paperId: out.paperId } : null;
      await toast(out.message, out.kind === "saved" || out.kind === "queued" ? "ok" : "error", undo);
      return;
    } catch {
      // The page wouldn't take the note. Anything already saved is safe in the outbox.
      if (imageUrl) return;
    }
  }
  await openShareWindow(fallback);
}

// Toolbar button, or the Alt+Shift+P shortcut: saves what is highlighted (the
// words, the first picture in it, and the page's address), or the page itself
// when nothing is.
chrome.action.onClicked.addListener(async (tab) => {
  void flush();
  const selection = await selectionOf(tab);
  await saveFromPage(tab, pickShare("page", tab, {}, selection.text), selection.image);
});

// Alt+Shift+N: a box on the page to type a thought into. With the shortcut set to
// "Global" at chrome://extensions/shortcuts it also works while Chrome is in the background.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "quick-thought") return;
  void flush();
  const tab = await activeTab();
  const { mode } = await settings();
  // Pressed from another app (a Global shortcut): the page isn't in front, so use the window.
  const chromeFocused = await chrome.windows.getLastFocused().then((w) => w.focused, () => true);
  if (tab?.id && chooseSurface({ mode, url: tab.url, chromeFocused }) === "overlay") {
    try {
      await onPage(tab, () => window.__ppQuick.toggle());
      return;
    } catch {
      // The page refused scripts after all: use the window.
    }
  }
  await openQuickWindow();
});

// Right-click: the same straight save. A picture keeps the page it was on as its caption.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  void flush();
  const kind = String(info.menuItemId);
  if (kind === "image") {
    await saveFromPage(tab, pickShare("page", tab), info.srcUrl, pickShare("image", tab, info));
    return;
  }
  const selection = kind === "selection" ? await selectionOf(tab) : { text: "", image: "" };
  await saveFromPage(tab, pickShare(kind, tab, info, selection.text), selection.image);
});

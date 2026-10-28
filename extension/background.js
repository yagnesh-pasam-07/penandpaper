import { buildCaptureUrl, buildShareUrl, DEFAULT_SERVER, pickShare } from "./share-url.js";

// A small separate window, so saving never takes you away from the page.
const WINDOW = { type: "popup", width: 420, height: 340, focused: true };
// The quick-thought box is just a text field.
const QUICK_WINDOW = { type: "popup", width: 420, height: 180, focused: true };

const MENU = [
  { id: "page", title: "Save page to Pen & Paper", contexts: ["page"] },
  { id: "selection", title: "Save selection to Pen & Paper", contexts: ["selection"] },
  { id: "link", title: "Save link to Pen & Paper", contexts: ["link"] },
  { id: "image", title: "Save image to Pen & Paper", contexts: ["image"] },
];

async function server() {
  const { server: saved } = await chrome.storage.sync.get("server");
  return saved || DEFAULT_SERVER;
}

async function open(fields) {
  await chrome.windows.create({ ...WINDOW, url: buildShareUrl(await server(), fields) });
}

/** The words selected on the page, if the browser lets the extension read them (not on chrome:// pages). */
async function selectionOf(tab) {
  if (!tab?.id) return "";
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => String(getSelection() ?? "") });
    return result?.result ?? "";
  } catch {
    return "";
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU) chrome.contextMenus.create(item);
  });
});

// Toolbar button, or the Alt+Shift+P shortcut.
chrome.action.onClicked.addListener(async (tab) => {
  await open(pickShare("page", tab, {}, await selectionOf(tab)));
});

// Alt+Shift+N: a small box to type a thought into. With the shortcut set to
// "Global" at chrome://extensions/shortcuts it also works while Chrome is in the background.
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "quick-thought") await chrome.windows.create({ ...QUICK_WINDOW, url: buildCaptureUrl(await server()) });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await open(pickShare(String(info.menuItemId), tab, info));
});

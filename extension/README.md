# Pen & Paper browser extension

Saves what you're looking at onto your latest Pen & Paper paper: the page, some selected words, a link or an image. Chrome and Edge (Manifest V3).

**It is not on the Chrome Web Store.** You load it yourself, as below. Nothing needs building.

## Install

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `extension/` folder.
3. Pin the Pen & Paper icon from the puzzle-piece menu if you want it on the toolbar.

Sign in to Pen & Paper in the same browser first. If you aren't signed in, the extension opens the log-in page in a new tab; sign in and press the shortcut again.

**After you update the extension's files, reload it:** at `chrome://extensions`, click the circular arrow on the Pen & Paper card, then reload the page you want to use it on.

## Use it

- **Alt+Shift+N** (Option+Shift+N on a Mac): a small box pops up **on the page you're on**, in the middle of the tab. Type a thought, press **Enter** (or **Cmd/Ctrl+Enter**) to save it to your latest paper, **Shift+Enter** for a new line. The box closes at once and a small note at the bottom of the page says **Saved to _your paper_** with an **Undo** button for 5 seconds. **Esc** (or a click outside) closes it without saving, and what you had typed is **kept as a draft** for the next time you open it. Press the shortcut again to close it. No new window opens.

- **Attach this page** (a tick box in the box, off by default, and it remembers your last choice): adds the page's title and address under your words. A YouTube address then shows as a video card on the paper.
- **It opens instantly.** Nothing is fetched when it opens: the paper's name, your last choice and any draft are read from this device.
- **Nothing is lost.** The box hands the thought to the extension, which keeps it on this device first and then sends it. If you're offline, signed out or the site has a hiccup, the note says **Saved on this device, will sync** (or **Sign in to sync**, and the log-in page opens), and it is sent later: when the browser starts, when the network comes back, and the next time you press a shortcut or save anything.
- **Keyboard and screen readers:** the box is a labelled dialog, Tab and Shift+Tab stay inside it, focus goes back to where you were when it closes, and it follows your light or dark setting. A character count appears only near the 1,000-character limit.
- **Toolbar button** or **Alt+Shift+P**: saves the page (its title and address, plus any words you have selected) and shows a small **Saved to _your paper_** note at the bottom of the page.
- **Right-click** on the page, a selection, a link or an image, then **Save … to Pen & Paper**. These open the small saving window, which closes itself.

To change a shortcut, go to `chrome://extensions/shortcuts`.

### Where the box can't appear

A browser doesn't let an extension draw on its own pages (`chrome://…`, the new tab page, `view-source:`), on the Chrome and Edge extension stores, in the built-in PDF viewer, or on `file://` pages. On those, **Alt+Shift+N** and **Alt+Shift+P** fall back to a small separate window (`/capture`, and `/share`), exactly as before. If you'd rather always have the window, pick **A small separate window** in Options.

### A shortcut that works while Chrome is in the background

At `chrome://extensions/shortcuts`, each shortcut has a **Scope** menu. Set **Quick thought** (Alt+Shift+N) to **Global** and it works even when another app is in front, so you can press it from anywhere and type. Only you can change the scope; an extension can't set it for itself. Two honest limits: Chrome (or Edge) has to be running, even if it's minimised, and some keys are already taken by your system or other apps, in which case Chrome won't accept the combination and you should pick another. The scope menu also lets you choose a different key.

## Settings

Right-click the icon, then **Options**. By default it saves to https://penandpaper-app.vercel.app. Pick **This computer** (`http://localhost:3000`) while developing, or type another https address (the browser then asks you once to allow the extension to talk to that address). You can also choose whether **Alt+Shift+N** shows a box on the page (the default) or a small separate window.

## What it can see, in plain words

| Permission | Why |
| --- | --- |
| `activeTab` | Read the title, address and selected words of the tab you click it on, only at the moment you click. It never reads other tabs or pages in the background. |
| `scripting` | Read the selected words on that tab. |
| `contextMenus` | The right-click items. |
| `commands` (shortcuts) | The two keyboard shortcuts. These need no permission prompt; they are listed in the manifest. |
| `storage` | Remember which server and which style of box you chose. |
| `https://penandpaper-app.vercel.app/*` | Send a thought you typed to your paper, using your sign-in. Only that address. |
| `http://localhost:3000/*` | The same, for developing on this computer. Only that address. |
| optional: any other `https://` address | Asked for only if you type your own server in Options, one address at a time. |

It does not read your history or other websites. It does not send anything anywhere except to the Pen & Paper address you chose, and only when you save. Because it now talks to the site directly, the browser may show a warning about it reading data on those two addresses when you update it.

## How it works

**The box on the page.** The background worker injects `overlay.js` into the tab (allowed because the shortcut counts as you asking it to act on that tab). The box lives in a closed shadow root, so the page's own styles and scripts can't change it. When you save, the box asks the worker, and the worker sends `{id, text}` to `<server>/api/drop/capture` with your browser's sign-in cookie. The site accepts that request when it is from the site's own page **or** from a browser extension (`Origin: chrome-extension://…`, which a web page can't fake) and you are signed in (`src/app/api/drop/capture/route.ts`, `canCapture` in `src/modules/drop/share.ts`). If you aren't signed in, the log-in page opens in a new tab and the box says "Sign in, then try again". Each thought gets one random id, so retrying after a dropped connection is still one note.

**The window.** The right-click items and the fallback open `<server>/share?title=…&text=…&url=…&from=ext` in a small window. The site's `/share` page does the saving (`src/app/share/route.ts`), then shows `/share/done` and the window closes. A window the browser itself opens should count as you starting the save, so it saves straight away; if the browser doesn't report that, the window shows an **Add** button and one tap saves it (on purpose, so another website can't add notes by linking to `/share`).

The pure logic (what to save, which style to use, what to say about the answer) is in `capture.js` and `share-url.js`, with tests (`npm test`).

### Honest limits

- Retries happen when the browser starts, when the network comes back and when you use a shortcut or save; there is no timer running in the background (that would need one more permission), so a thought that failed waits for one of those. It is never dropped while it can still be sent.
- Undo takes the note off the paper (it is crumpled, and removed for good after 7 days); it can't recall a thought that has already been emailed in the evening list.
- A page that listens for keys on `window` in the capture phase can still see what you type in the box. Ordinary page shortcuts (a video player's space bar, a mail app's letters) can't, because the box stops keys from bubbling up to the page.
- The sign-in cookie only reaches the site if the browser sends it for extension requests. Chrome does for addresses the extension has permission for. If saving ever says "Sign in, then try again" although you are signed in, choose **A small separate window** in Options and tell us.
- Text selected inside a PDF or on a browser page can't be read.

## Files

- `manifest.json`: the extension's description and permissions.
- `background.js`: the toolbar button, the two shortcuts, the right-click items, and the saving.
- `overlay.js`: the box and the "Saved" note drawn on the page.
- `capture.js`: pure helpers for saving (the text, the id, attach this page, which style, what to say).
- `outbox.js`: the pure queue that keeps unsent thoughts (retry timing and which failures to retry) and the draft rule.
- `share-url.js`: pure helpers (server check, what to save, the window's address).
- `options.html`, `options.js`: the settings page.
- `icons/`: toolbar icons, drawn from `src/app/icon.svg` by `node extension/make-icons.mjs`.

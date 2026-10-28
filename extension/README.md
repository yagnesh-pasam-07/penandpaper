# Pen & Paper browser extension

Saves what you're looking at onto your latest Pen & Paper paper: the page, some selected words, a link or an image. Chrome and Edge (Manifest V3).

**It is not on the Chrome Web Store.** You load it yourself, as below. Nothing needs building.

## Install

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `extension/` folder.
3. Pin the Pen & Paper icon from the puzzle-piece menu if you want it on the toolbar.

Sign in to Pen & Paper in the same browser first. If you aren't signed in, the little window sends you to the log-in page and then saves the note.

## Use it

- **Toolbar button** or **Alt+Shift+P**: saves the page (its title and address, plus any words you have selected).
- **Alt+Shift+N**: opens a small box to type a thought into. **Enter** saves it to your latest paper, **Shift+Enter** is a new line, **Esc** closes. It closes itself after saving.
- **Right-click** on the page, a selection, a link or an image, then **Save … to Pen & Paper**.

A small window opens, says **Saved to _your paper_** and closes itself. If your browser keeps it open, it says you can close it. To change a shortcut, go to `chrome://extensions/shortcuts`.

### A shortcut that works while Chrome is in the background

At `chrome://extensions/shortcuts`, each shortcut has a **Scope** menu. Set **Quick thought** (Alt+Shift+N) to **Global** and it works even when another app is in front, so you can press it from anywhere and type. Only you can change the scope; an extension can't set it for itself. Two honest limits: Chrome (or Edge) has to be running, even if it's minimised, and some keys are already taken by your system or other apps, in which case Chrome won't accept the combination and you should pick another. The scope menu also lets you choose a different key.

## Settings

Right-click the icon, then **Options**. By default it saves to https://penandpaper-app.vercel.app. Pick **This computer** (`http://localhost:3000`) while developing, or type another https address.

## What it can see, in plain words

| Permission | Why |
| --- | --- |
| `activeTab` | Read the title, address and selected words of the tab you click it on, only at the moment you click. It never reads other tabs or pages in the background. |
| `scripting` | Read the selected words on that tab. |
| `contextMenus` | The right-click items. |
| `commands` (shortcuts) | The two keyboard shortcuts. These need no permission prompt; they are listed in the manifest. |
| `storage` | Remember which server you chose. |

It asks for no access to websites, history or cookies. It does not send anything anywhere except to the Pen & Paper address you chose, and only when you save.

## How it works

The extension only opens `<server>/share?title=…&text=…&url=…&from=ext` in a small window. The site's existing `/share` page does the saving with your normal sign-in (`src/app/share/route.ts`), then shows `/share/done` and the window closes. A window the browser itself opens should count as you starting the save, so it saves straight away; if the browser doesn't report that, the window shows an **Add** button and one tap saves it (the site does this on purpose, so another website can't add notes by linking to `/share`). The URL-building code is in `share-url.js` and has tests (`npm test`).

## Files

- `manifest.json`: the extension's description and permissions.
- `background.js`: the toolbar button, the two shortcuts and the right-click items.
- `share-url.js`: the pure helpers (server check, what to save, the window's address).
- `options.html`, `options.js`: the settings page.
- `icons/`: toolbar icons, drawn from `src/app/icon.svg` by `node extension/make-icons.mjs`.

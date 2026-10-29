# Pen & Paper Capture (macOS menu-bar app)

A small native Mac app that lives in the menu bar and captures a thought from **any app**, even when Chrome is closed:

- **⌥⇧N** opens a floating "Quick thought" box over whatever you are doing (it also appears over full-screen apps). Type, press **Enter**, and it is saved to your latest paper. **Shift+Enter** is a new line, **Esc** closes and keeps your words for next time.
- **Hold ⌥Space** and talk. A small "Listening…" pill shows while you hold. Let go and the recording is sent to your server, turned into text, and saved to your latest paper.

Both shortcuts can be changed in **Settings…**.

## Build and run

You need macOS 13 or later and Xcode (or the Command Line Tools) with Swift 5.9+. No other dependencies.

```bash
./mac/build-app.sh          # builds mac/PenAndPaper.app
open mac/PenAndPaper.app    # first time: right-click the app in Finder → Open
swift test --package-path mac   # the unit tests for the pure logic
```

The app is **ad-hoc signed and not notarized**, so macOS Gatekeeper warns the first time: right-click the app → **Open** → **Open**. Move it to **Applications** if you want "Launch at login" to work.

## First run

1. Sign in to Pen & Paper in your browser, open **Settings → Desktop app** and **create a token**. It is shown once.
2. In the menu-bar app choose **Sign in with token…** and paste it. It is stored in your **Keychain**, not in a file.
3. For a local copy of the site, open **Settings…** and set the server to `http://localhost:3000`. **Test connection** shows which paper notes go to.

## Permissions, in plain words

- **Microphone**: asked the first time you hold the talk shortcut. It records only while the keys are held.
- No Accessibility or Screen Recording permission is needed. The shortcuts use macOS's standard hot-key API.
- The app talks only to the server you set, with `Authorization: Bearer <token>` (never in the address).

## Never loses a thought

Every note (and every recording) is written to `~/Library/Application Support/PenAndPaperCapture/` **before** it is sent. If you are offline, signed out, or the server hiccups, it waits and retries (30 s, 1 min, 2 min … up to an hour, and again when the network returns or the app starts). The menu shows how many are waiting. A note the site can never accept (for example an empty one) is dropped.

## What it expects from the server

- `POST /api/drop/capture` `{ id, text }` → `{ id, paperId, paperName }` (typed notes).
- `GET /api/drop/capture` → `{ paperId, paperName }` (the "to <paper>" label).
- `POST /api/drop/transcribe` multipart `audio` (m4a), `save=1`, `id` → `{ text, id, paperId, paperName }` (voice). Errors: 401 sign in, 422 "didn't catch anything", 429 slow down, 503 voice isn't set up (the server needs `OPENAI_API_KEY`).

## Limits

- **Undo** is not offered yet: the site's delete endpoint only accepts a browser sign-in, not a token. The request builder exists (`API.undo`); flip `Capture.undoSupported` once the site accepts it.
- macOS 13+, Apple silicon build by default (change `--arch` in `build-app.sh` for Intel).
- Not notarized and not on the App Store. Notarizing needs an Apple developer account.
- Rebuilding the app changes its ad-hoc signature, so macOS may ask for the microphone again.
- The icon is scaled up from the 128 px extension icon.
- A shortcut another app already owns is refused; the app says so and you can pick another in Settings.
- The app has not been clicked through on a real screen by the agent that wrote it. See the manual test steps below.

## Manual test steps

1. `./mac/build-app.sh`, then right-click `mac/PenAndPaper.app` → **Open**. A pen icon appears in the menu bar and a sign-in box asks for a token.
2. Paste a token (web app → Settings → Desktop app). You should see "Signed in." Choose **Settings… → Test connection**: it should say "Connected. Notes go to …".
3. Switch to another app (Notes, Slack, a full-screen app). Press **⌥⇧N**: a box appears over it. Type "mac test" and press **Enter**. The box closes and a toast says "Saved to …". Open the web app: the note is on your latest paper.
4. Turn Wi-Fi off, repeat: the toast says "Saved on this Mac, will sync" and the menu shows "1 waiting to sync". Turn Wi-Fi on: within a minute it syncs.
5. Press **⌥⇧N**, type something, press **Esc**, press **⌥⇧N** again: your words are still there.
6. Hold **⌥Space** (the first time it asks for the microphone, then hold again), say a sentence, let go: a pill shows "Listening…", then a toast "Saved: …". With no `OPENAI_API_KEY` on the server you get "Voice isn't set up on the server yet" and the recording is kept.
7. **Settings…**: change a shortcut by clicking its box and pressing new keys; toggle **Launch at login** (works once the app is in Applications).

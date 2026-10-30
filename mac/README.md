# Pen & Paper Capture (macOS menu-bar app)

A small native Mac app that lives in the menu bar and captures a thought from **any app**, even when Chrome is closed:

- **⌥⇧N** opens a floating "Quick thought" box over whatever you are doing (it also appears over full-screen apps). Type, press **Enter**, and it is saved to your latest paper. **Shift+Enter** is a new line, **Esc** closes and keeps your words for next time.
- **Hold ⌥Space** and talk. A small "Listening…" pill shows the words as they are recognised. Let go and they are saved to your latest paper like a typed note. The words are recognised by **Apple's speech recogniser on your Mac**, so voice needs no server key and no account.
- Every save shows a toast with **Undo** for a few seconds.

Both shortcuts, and the language you speak, can be changed in **Settings…**.

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

- **Microphone** and **Speech Recognition**: each is asked the first time you hold the talk shortcut (hold it again after you allow them). It listens only while the keys are held. If you said no, allow them in System Settings → Privacy & Security → Microphone / Speech Recognition.
- No Accessibility or Screen Recording permission is needed. The shortcuts use macOS's standard hot-key API.
- The app talks only to the server you set, with `Authorization: Bearer <token>` (never in the address).

## Voice: languages, on-device and limits

- **Language:** Settings… → Voice → Language. It starts as your Mac's own language. English (India), English (US), हिन्दी and తెలుగు are listed first when this Mac supports them, followed by every other language Apple supports.
- **On this Mac or Apple's servers:** where a language supports on-device recognition (the Settings note says which), your voice never leaves the Mac. Where it doesn't, the request goes to Apple's servers, as dictation does. Hindi is usually available on-device; **Telugu often isn't**, depending on the macOS version, and then it is recognised by Apple's servers and needs the internet. If a language is missing from the list, this Mac's recogniser doesn't support it. Add languages under System Settings → Keyboard → Dictation.
- **Quality:** recognition of Telugu and mixed Hindi-English speech is noticeably weaker than English. Typing is always an option (⌥⇧N).
- **Optional server transcription:** Settings… → Voice → "Use server transcription" sends a recording to the site's `/api/drop/transcribe`, which needs an `OPENAI_API_KEY` on the server (good for mixed languages, costs a little per minute). Off by default.
- **Nothing said** → "Didn't catch anything." and nothing is saved. A hold under 0.3 s is ignored, and a hold stops at 60 s.

## Never loses a thought

Every note (and every recording) is written to `~/Library/Application Support/PenAndPaperCapture/` **before** it is sent. If you are offline, signed out, or the server hiccups, it waits and retries (30 s, 1 min, 2 min … up to an hour, and again when the network returns or the app starts). The menu shows how many are waiting. A note the site can never accept (for example an empty one) is dropped.

## What it expects from the server

- `POST /api/drop/capture` `{ id, text }` → `{ id, paperId, paperName }` (typed and spoken notes).
- `DELETE /api/drop/thoughts/<id>?paper=<paperId>` → 204 (Undo; accepts the token).
- `GET /api/drop/capture` → `{ paperId, paperName }` (the "to <paper>" label).
- `POST /api/drop/transcribe` multipart `audio` (m4a), `save=1`, `id` → `{ text, id, paperId, paperName }` (only when "server transcription" is on). Errors: 401 sign in, 422 "didn't catch anything", 429 slow down, 503 the server's voice isn't set up (it needs `OPENAI_API_KEY`).

## Limits

- **Undo** crumples the note on the site (kept for a week there). It can't recall a note already in the evening email.
- macOS 13+, Apple silicon build by default. `UNIVERSAL=1 ./mac/build-app.sh` builds one app for Apple silicon and Intel (not yet tested on an Intel Mac).
- Not notarized and not on the App Store. Notarizing needs an Apple developer account.
- Rebuilding the app changes its ad-hoc signature, so macOS may ask for the microphone and speech recognition again.
- The icon is scaled up from the 128 px extension icon.
- A shortcut another app already owns is refused; the app says so and you can pick another in Settings.
- The app has not been clicked through on a real screen by the agent that wrote it. See the manual test steps below.

## Manual test steps

1. `./mac/build-app.sh`, then right-click `mac/PenAndPaper.app` → **Open**. A pen icon appears in the menu bar and a sign-in box asks for a token.
2. Paste a token (web app → Settings → Desktop app). You should see "Signed in." Choose **Settings… → Test connection**: it should say "Connected. Notes go to …".
3. Switch to another app (Notes, Slack, a full-screen app). Press **⌥⇧N**: a box appears over it. Type "mac test" and press **Enter**. The box closes and a toast says "Saved to …". Open the web app: the note is on your latest paper.
4. Turn Wi-Fi off, repeat: the toast says "Saved on this Mac, will sync" and the menu shows "1 waiting to sync". Turn Wi-Fi on: within a minute it syncs.
5. Press **⌥⇧N**, type something, press **Esc**, press **⌥⇧N** again: your words are still there.
6. Hold **⌥Space**. The first time it asks for the microphone, then for Speech Recognition; allow both and hold again. Say a sentence: the pill shows "Listening…" with your words appearing. Let go: a toast says "Saved: …" with **Undo**, and the note is on your latest paper. Hold and say nothing: "Didn't catch anything." and nothing is saved. A quick tap does nothing.
7. Press **Undo** on a toast within 5 seconds: it says "Undone." and the note disappears from the paper.
8. **Settings… → Voice**: pick हिन्दी or తెలుగు and read the note under the menu (on this Mac, or Apple's servers). Turn **Use server transcription** on only if the server has an OpenAI key.
9. **Settings…**: change a shortcut by clicking its box and pressing new keys; toggle **Launch at login** (works once the app is in Applications).

# Pen & Paper

Plan the day, on paper. Live at **https://penandpaper-app.vercel.app**.

Two modules share one app, one sign-in and one database. The public homepage (`/`) lets visitors try Drop without an account (kept in their browser, moved onto their paper when they sign up); signed-in visitors go straight to `/drop`.

| Module | What it does | Where |
| --- | --- | --- |
| **Drop** | A canvas of papers you make yourself. Open one, type, press Enter: the thought lands on it. Make as many papers as you like, find anything across all of them, and get an evening email of what you dropped. | `/drop`, code in `src/modules/drop` |
| **Team** | Parked for now: its routes redirect to `/drop` and nothing links to it. A lead drops thoughts, estimates them, and drags them onto people. | code in `src/screens` |

- [Product Requirements Document](docs/PRD.md) (team planner)

## Drop

![Drop: a paper with dropped and struck thoughts](docs/images/drop-today.jpg)

| On a phone: a vertical stream | Ink (dark) |
| --- | --- |
| ![Drop on a phone](docs/images/drop-phone.png) | ![Drop in the dark theme](docs/images/drop-today-dark.jpg) |

- **Canvas home**: `/drop` opens the paper you touched last (a first blank one if you have none), at `/drop/<paper>`. Press Space, start typing, or tap the floating **Write…** pen to open the writer (it opens by itself on an empty paper). Enter drops the thought and keeps the writer open for the next; Shift+Enter is a new line; Esc or a click outside closes it and keeps any unfinished text as a draft. Each note flies from the writer to its place on the sheet.
- **Bubbles**: hand-cut notes, each with its own imperfect outline (seeded by when it was dropped, so it keeps its shape across days) and a faint ink edge, with the time it was dropped shown on hover. Click to edit; double-click (or swipe right on a phone) to strike out: one thin red pen line draws across the words, which stay readable, and the thought stays exactly where it is (strike it again to take the line off); delete from the edit view or the hover buttons. Links are clickable, and show a preview under the note: a YouTube video its thumbnail, any other link its site and path.
- **Papers you make**: the **+** in the header makes a new blank paper (a name is optional; the date it was made shows by itself). Thoughts stay on the paper they were dropped on, and nothing is carried between papers. Papers are not tied to days: make several in one day, or leave one alone for weeks.
- **Switcher**: the paper's name in the header opens a list of all your papers, newest first, with the date made and how many thoughts each holds. The same menu renames (or double-click the name), archives and deletes the open paper. On a phone it opens as a sheet from the bottom.
- **Library**: `/drop/library` shows every paper as a small card (a miniature of its canvas, name, date made, thought count), newest first, with an **Archived** toggle. Every paper stays fully editable. Rename, archive (put away, hidden from the switcher) and delete live on each card.
- **Delete**: a deleted paper disappears at once, with an Undo; the nightly cron removes it for good after 7 days, like crumpled thoughts.
- **Search**: the magnifier in the header, or Ctrl/⌘ K, searches the words of every thought on every paper (any case, newest first, up to 50). A result opens its paper and the note pulses.
- **9 PM email**: Vercel Cron at 15:30 UTC (21:00 IST) emails what you dropped today (subject "Tonight's paper · 9 thoughts"), grouped by paper (its name, or the date it was made), struck ones with their line. A big **Review tonight's paper** button above the list opens [Tonight's paper](#tonights-paper) (signing in first if needed); "Or open my paper" goes to the paper you wrote on last. No email if nothing was dropped that day.
- **Tonight's paper** (`/tonight`): the evening review, below.
- **Arrange**: new drops land in a row right under the input; arranged thoughts keep their shape below. Drag a thought anywhere on the page. It snaps like a magnet to a neighbour's centre or edges (a red guide line shows it), otherwise to the dots. The spot is saved and carries over with the thought; new drops land in the free space. **Tidy up** puts everything back into rows.
- **Pan and zoom**: Ctrl/⌘ + scroll (or a trackpad pinch) zooms around the pointer, 10–300%; drag empty canvas or use the middle mouse button to pan; the − / percent / + control at the bottom right resets the view. Each paper remembers its own view on this device. The pattern and the notes move together.
- **No edges**: a note can be dropped anywhere on the canvas at any zoom, left of or above where the paper starts, as far as ±200 column-widths sideways and ±200,000 px up or down (the API's sanity limits). Drag near the window's edge and the view drifts so a note can be carried past one screen; **Fit all** (bottom right) zooms and pans to show every note, down to 10%. Spots are still saved as a share of the 1,056 px reading column (x) and pixels (y), so older papers look exactly as they did; only the allowed range is wider.
- **Appearance**: `/settings` picks the canvas (Dotted, Grid or Ruled) and Light, Dark or System. It applies at once, is kept on the device, and is saved to your account.
- **Crumple**: ✕, Delete, swipe left, or the editor all crumple (with a 6-second Undo). Crumpled thoughts are hidden everywhere and swept up for good after 7 days by the nightly cron.
- **Handwriting**: notes in Kalam (the most legible of Caveat, Kalam, Patrick Hand, Gochi Hand and Nanum Pen Script at 18–24px; Caveat stays for headings), with a tiny per-word wobble seeded per note, ink write-on when dropped, paper grain, and Telugu (Gurajada) / Hindi (Kalam) handwriting.
- **Keyboard first**: Space, or simply typing, opens the writer from anywhere on the page (the first letter goes in); Enter drops; Esc closes.
- **Phone**: the canvas becomes a vertical stream with the same input.
- Sign-in required: signed-out visits go to `/signup?next=/drop`.

Shared canvas pieces (bubble looks, the dotted sheet, the interactive thought bubble) live in `src/components/canvas` so the team module can use them too.

## Tonight's paper

An evening ritual that is not a to-do list: one calm pass over what you dropped **today** (on your own clock), across all your papers, deciding nothing more than "did this matter".

- **The cards:** `/tonight` shows one thought at a time, big, in the handwriting look, with its paper's name and the time it was dropped. Progress reads "3 of 9". Oldest first. Pictures and YouTube thumbnails show as on the paper.
- **Three choices:** **Strike** (S, or swipe right) draws the red pen line; the thought stays on its paper, struck. **Keep** (K, or click or tap the card) leaves it as it is. **Crumple** (X, or swipe left) crumples it, with a 6-second Undo and the usual 7-day cleanup. On a phone the same three are big buttons at the bottom.
- **Back** (← or Backspace, or "← Change the last one" after the end) puts the previous card back exactly as it was and lets you decide again. **Esc** leaves; nothing is lost, because every choice is saved on the thought as you make it, so reopening resumes at the first undecided card.
- **Closed:** when the last card is done a red-ink **PAPER CLOSED ✓** stamp comes down with "4 struck · 3 kept · 2 crumpled" and a **Good night** button. Opening `/tonight` again after finishing shows the stamp and summary, not cards. Dropping a new thought afterwards reopens the day for just that thought.
- **What is included:** thoughts dropped today on any paper that isn't deleted (archived ones count). Thoughts you already struck or crumpled today are skipped. A thought is "reviewed" once the ritual has decided it, and is never shown again that day.
- **Where to start it:** the 9 PM email's button, or a small **Tonight** link in the header that appears only from 18:00 on your clock and only while thoughts are waiting (it looks again when you return to the tab).
- **Time zone:** the browser tells the server its zone in a `pp-tz` cookie (the first visit may use `DROP_TIMEZONE`, default Asia/Kolkata, and refreshes once). The email has no browser, so it uses `DROP_TIMEZONE`. A day runs midnight to midnight local time, including the 23- and 25-hour days when clocks change.
- **Data:** `drop_thoughts.reviewed_at` marks a decided thought; `drop_daily_reviews` keeps one row per person per day (struck, kept, crumpled, `completed_at`). The counts are worked out again from the thoughts after every choice, so Back and Undo can't leave them wrong. Reviewing doesn't "touch" a paper, so it doesn't change which paper a new capture lands on.
- **API:** `GET /api/drop/tonight` returns `{ date, total, reviewed, remaining, completed, summary: { struck, kept, crumpled }, next }` (add `?lite=1` to leave out `next`). `POST /api/drop/tonight` with `{ thoughtId, action }`, action `strike`, `keep`, `crumple` or `undo`, is same-site only and idempotent. Code: `src/modules/drop/tonight*.ts(x)`, `src/app/tonight`, `src/app/api/drop/tonight`.
- **Limits:** up to 300 cards per load (oldest first). A review that runs past midnight keeps counting each thought on the day it was dropped, but `/tonight` only lists the new day's thoughts after midnight.

## Capture from anywhere

Pen & Paper installs as an app, and other apps can share to it.

- **Install**: the manifest (`src/app/manifest.ts`) makes it installable. Chrome and Edge offer **Install app** in the account menu; on Android use Chrome's menu → Install app; on iPhone and iPad use Share → Add to Home Screen. It has no service worker: current Chrome doesn't need one to install, and nothing here should be cached offline (every page is signed-in and live).
- **Share to Pen & Paper** (`/share`): from any app's Share sheet, a link, some words or a picture lands as a note on the paper you touched last, then opens it with the note highlighted. A title, text and link become one note (a link already in the text isn't repeated). Pictures must be PNG, JPG, GIF or WebP and about 1 MB (the same limit as pasting); a bigger one is skipped with a notice, since the browser's share can't shrink it first. Sharing the same thing twice within five minutes makes one note.
- **Quick drop**: the home-screen shortcut **New thought** (long-press the icon on Android) opens `/drop?write=1`, the writer on your latest paper. **Library** opens `/drop/library`.
- **Safe by design**: a share saves straight away only when it comes from the browser or OS itself, or from this site (`Sec-Fetch-Site: none` or `same-origin`). Anything else, or a browser that doesn't say, gets an "Add to …? [Add] [Cancel]" screen first, so another website can't add notes to your paper by linking to `/share`. Signed out, it goes to log in and comes back to the same share (a picture can't make that trip; the words do).
- **Limits**: Android Chrome supports both install and Share to. **iPhone Safari supports Add to Home Screen but not Share Target**, so on iOS open the home-screen app and start typing (the shortcuts below are an Android and desktop feature too). Desktop Chrome can install it and share to it too.
- **Quick thought** (`/capture`): one box to type a thought into. **Enter** saves it to the paper you touched last, **Shift+Enter** is a new line, **Esc** closes. It's the installed app's third shortcut (**Quick thought**) and what the browser extension's **Alt+Shift+N** opens. It saves with a same-origin request only (`/api/drop/capture`), so another website can't send it.
- **Browser extension** (`extension/`, Chrome and Edge): **Alt+Shift+N** (Option+Shift+N on a Mac) pops a small "Quick thought" box up **on the page you're on**; Enter saves it to your latest paper and it closes. The toolbar button and **Alt+Shift+P** save the page (title, link, any selected words) and show a small "Saved" note on the page. Right-click items (**Save page / selection / link / image to Pen & Paper**) use a small window on `/share?…&from=ext`. On pages a browser keeps extensions out of (`chrome://`, the new tab page, extension stores, PDFs) it falls back to the small window. It uses your signed-in session, so there is no token; `POST /api/drop/capture` accepts only this site's own page or a browser extension, and only when you are signed in. After updating its files, reload it at `chrome://extensions`. It is not on the Chrome Web Store: load it unpacked (see [`extension/README.md`](extension/README.md)).

## Run it locally

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL, BETTER_AUTH_SECRET, …
npm run db:migrate              # create tables on your database
npm run seed -- you@example.com # optional: a few Drop papers for that email
npm run dev                     # http://localhost:3000
```

Without Resend configured, development prints every email (sign-in links included) to the terminal, so you can sign in by opening the link from there.

`npm run dev` clears `.next` first: a production build left there breaks the dev server.

Other scripts: `npm test` (unit tests), `npm run lint`, `npm run build`, `npm run db:generate` (after changing a schema), `npm run db:studio`.

## Personal access tokens

Apps that save to your paper without a browser sign-in (the coming Mac menu-bar app) use a personal access token. Make one in **Settings → Desktop app**.

- **Format:** `pp_` followed by 32 random bytes, URL-safe. It is shown **once**, when you make it; only its SHA-256 is stored, so a lost token can't be recovered, only revoked and replaced.
- **Use:** send it as `Authorization: Bearer pp_…`. It is never read from a URL or query string, and a token can't manage tokens (that needs a browser sign-in on this site).
- **Save:** `POST /api/drop/capture` with `{ "id": "<lowercase letters, digits, hyphens, 6-40 long>", "text": "…" }` replies `{ "id", "paperId", "paperName" }`. Sending the same `id` again is one note. `GET /api/drop/capture` replies `{ "paperId", "paperName" }`: where a save would land (your most recently touched paper).
- **Limits:** up to 5 active tokens each; 60 saves per token per minute (429 with `Retry-After: 60` beyond that). Revoked or unknown tokens get 401.
- **Revoke:** Settings → Desktop app → Revoke. It stops working at once and stays in the list.

## Voice transcription

Speak a thought and it becomes text, **with no API key needed**. In the writer, the **mic** button (or **⌘/Ctrl + Shift + M**) starts and stops listening; the words are inserted at the cursor and are not dropped until you press Enter. Esc while listening throws it away; it stops by itself after a minute.

- **The browser's own recogniser (default, no key):** in Chrome, Edge and Safari the writer uses the Web Speech API. Your words appear live in the box as you speak, and a small language menu next to the mic picks English, हिन्दी or తెలుగు (remembered on this device; it starts from your browser's language). Chrome and Edge send the audio to Google's or Microsoft's speech service to do this, and Safari to Apple's; Chrome's needs an internet connection. Firefox has no recogniser, so it falls back to recording and the server path below.
- **Server transcription (optional, needs a key):** where there is no browser recogniser, the writer records and sends the audio to `/api/drop/transcribe`, described next. The Mac app can use it too if you turn it on in its settings.

- **Endpoint:** `POST /api/drop/transcribe`, multipart form with `audio` (webm, ogg, mp3, mp4, m4a, wav or aac; up to 8 MB). Replies `{ "text" }`. Errors: 400 empty or no `audio`, 401 not signed in or bad token, 403 not from this site, 413 too big, 415 not an audio type, 422 "Didn't catch anything.", 429 more than 30 in 10 minutes (`Retry-After: 600`), 502/504 the transcriber failed or was slow, 503 voice isn't set up on this server.
- **Save in one step (for apps):** add `save=1` and an `id` (6-40 of a-z, 0-9, hyphen) and the words are also saved as a thought on your most recent paper, replying `{ "text", "id", "paperId", "paperName" }`. The same `id` again is one note. The Mac menu-bar app uses this with `Authorization: Bearer pp_…` (see Personal access tokens); the browser uses the session cookie.
- **Setup (optional):** set `OPENAI_API_KEY` (Vercel production, and `.env.local` to try it locally) only if you want the server path. Without it the endpoint answers 503, which affects only browsers without a recogniser (Firefox) and the Mac app's "server transcription" option. It uses `gpt-4o-mini-transcribe`, falling back to `whisper-1` when that model isn't available to the key.
- **Languages:** no language is forced, so English, Telugu, Hindi and others are detected from the audio.
- **Cost and privacy:** each recording is sent to OpenAI to be transcribed and costs a small amount per minute of audio. Nothing is kept by this app: only the words you choose to keep become a note.
- **Limits:** the site's `Permissions-Policy` allows the microphone for this site only (`microphone=(self)`). Vercel functions accept request bodies up to about 4.5 MB, which is far more than a minute of speech.

## Environment variables

See `.env.example` for the full annotated list.

| Variable | Needed | What for |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon pooled connection string (the app). |
| `DATABASE_URL_UNPOOLED` | for migrations | Neon direct connection string (`npm run db:migrate`). |
| `BETTER_AUTH_SECRET` | yes | Signs session cookies. One per environment: `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | production | The site's address, e.g. `https://penandpaper-app.vercel.app`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Sign-in links, invites, the evening email. `EMAIL_FROM`'s domain must be verified in Resend. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | "Continue with Google". Redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`. |
| `CRON_SECRET` | production | Vercel Cron sends it to `/api/cron/drop-digest`. `openssl rand -hex 24`. |
| `DROP_TIMEZONE` | optional | The day the evening email covers, and how dates read (default `Asia/Kolkata`). The cron time in `vercel.json` is fixed to 9 PM IST; change both together. |
| `OPENAI_API_KEY` | optional | Server speech-to-text (see Voice transcription). Not needed for the mic in Chrome, Edge or Safari, nor for the Mac app's default voice. |
| `SUPPORT_EMAIL` | optional | Contact address on `/privacy`. |

## Databases

Neon project `penandpaper` (Singapore), one branch per environment:

| Branch | Used by |
| --- | --- |
| `main` | Production |
| `preview` | Vercel Preview deployments |
| `dev` | Local development (`.env.local`) and Vercel Development |

Migrations live in `drizzle/`. Run `npm run db:migrate` against each branch after adding one.

## Deploy

Vercel project `penandpaper`, functions in `sin1` next to the database.

```bash
npx vercel deploy --prod
```

Set the variables above in Vercel → Settings → Environment Variables (Production, Preview, Development) before deploying.

## Code map

```
src/app/                 routes (pages and /api)
src/modules/drop/        Drop: schema, server queries, logic, screens
src/components/canvas/   shared bubbles and paper surface
src/screens/             team planner screens
src/db/                  Drizzle schema (auth + team), repository, connections
src/lib/                 auth, env, time zones, estimates, shared helpers
src/server/              API handling, session, email
scripts/seed.ts          seed data for Drop
```

## Mac menu-bar app

`mac/` is a native macOS app (Swift, no dependencies) that captures a thought from any app: **⌥⇧N** opens a floating quick-thought box, and holding **⌥Space** listens to your voice, which Apple's recogniser turns into a note (on your Mac where the language allows it, with no server key). Undo is on every save. It signs in with a personal access token (Settings → Desktop app), keeps everything in an on-disk outbox until the site has it, and is ad-hoc signed (not notarized). Build it with `./mac/build-app.sh`; see [mac/README.md](mac/README.md) for permissions, limits and manual test steps.

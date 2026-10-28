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
- **9 PM email**: Vercel Cron at 15:30 UTC (21:00 IST) emails what you dropped today ("Here's what you dropped today"), grouped by paper (its name, or the date it was made), struck ones with their line. "Open my paper" goes to the paper you wrote on last. No email if nothing was dropped that day.
- **Arrange**: new drops land in a row right under the input; arranged thoughts keep their shape below. Drag a thought anywhere on the page. It snaps like a magnet to a neighbour's centre or edges (a red guide line shows it), otherwise to the dots. The spot is saved and carries over with the thought; new drops land in the free space. **Tidy up** puts everything back into rows.
- **Pan and zoom**: Ctrl/⌘ + scroll (or a trackpad pinch) zooms around the pointer, 25–300%; drag empty canvas or use the middle mouse button to pan; the − / percent / + control at the bottom right resets the view. Each paper remembers its own view on this device. The pattern and the notes move together.
- **Appearance**: `/settings` picks the canvas (Dotted, Grid or Ruled) and Light, Dark or System. It applies at once, is kept on the device, and is saved to your account.
- **Crumple**: ✕, Delete, swipe left, or the editor all crumple (with a 6-second Undo). Crumpled thoughts are hidden everywhere and swept up for good after 7 days by the nightly cron.
- **Handwriting**: notes in Kalam (the most legible of Caveat, Kalam, Patrick Hand, Gochi Hand and Nanum Pen Script at 18–24px; Caveat stays for headings), with a tiny per-word wobble seeded per note, ink write-on when dropped, paper grain, and Telugu (Gurajada) / Hindi (Kalam) handwriting.
- **Keyboard first**: Space, or simply typing, opens the writer from anywhere on the page (the first letter goes in); Enter drops; Esc closes.
- **Phone**: the canvas becomes a vertical stream with the same input.
- Sign-in required: signed-out visits go to `/signup?next=/drop`.

Shared canvas pieces (bubble looks, the dotted sheet, the interactive thought bubble) live in `src/components/canvas` so the team module can use them too.

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

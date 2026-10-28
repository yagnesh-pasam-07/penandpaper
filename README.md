# Pen & Paper

Plan the day, on paper. Live at **https://penandpaper-app.vercel.app**.

Two modules share one app, one sign-in and one database. The public homepage (`/`) lets visitors try Drop without an account (kept in their browser, moved onto their paper when they sign up); signed-in visitors go straight to `/drop`.

| Module | What it does | Where |
| --- | --- | --- |
| **Drop** | A personal brain dump. Open the app, type, press Enter: the thought lands on today's paper. Unstruck thoughts roll over to tomorrow, and a 9 PM email lists the day. | `/drop`, code in `src/modules/drop` |
| **Team** | A lead drops thoughts, estimates them, and drags them onto people. Each person gets their paper at 9:00 in their own time zone. | `/projects`, `/me`, code in `src/screens` |

- [Product Requirements Document](docs/PRD.md) (team planner)

## Drop

![Drop: today's paper with dropped, struck and carried thoughts](docs/images/drop-today.jpg)

| On a phone: a vertical stream | Past papers | Ink (dark) |
| --- | --- | --- |
| ![Drop on a phone](docs/images/drop-phone.png) | ![Past papers](docs/images/drop-history.png) | ![Drop in the dark theme](docs/images/drop-today-dark.jpg) |

- **Canvas home**: `/drop` opens straight to today's paper. Press Space, start typing, or tap the floating **Write…** pen to open the writer (it opens by itself on an empty paper). Enter drops the thought and keeps the writer open for the next; Shift+Enter is a new line; Esc or a click outside closes it and keeps any unfinished text as a draft. Each note flies from the writer to its place on the sheet.
- **Bubbles**: hand-cut notes, each with its own imperfect outline (seeded by when it was dropped, so it keeps its shape across days) and a faint ink edge, with the time it was dropped shown on hover and a small ↻ on carried ones. Click to edit; double-click (or swipe right on a phone) to strike out: one thin red pen line draws across the words, which stay readable, and a moment later the thought sinks into a **Done today** row of small chips (↺ brings one back); delete from the edit view or the hover buttons. Links are clickable, and show a preview under the note: a YouTube video its thumbnail, any other link its site and path.
- **Daily paper**: each day (in `DROP_TIMEZONE`, default IST) is a fresh paper. Unstruck thoughts from the last paper roll over on the first open of the day, marked "from Sat".
- **9 PM email**: Vercel Cron at 15:30 UTC (21:00 IST) emails today's paper, open ones first and highlighted, done ones struck. No email if nothing was dropped that day.
- **History**: `/drop/history` lists past papers; each opens read-only.
- **Arrange**: new drops land in a row right under the input; arranged thoughts keep their shape below. Drag a thought anywhere on the sheet (it stays within the page column). It snaps like a magnet to a neighbour's centre or edges (a red guide line shows it), otherwise to the dots. The spot is saved and carries over with the thought; new drops land in the free space. **Tidy up** puts everything back into rows.
- **Pencil or pen**: Tab in the writer switches. Pencil is an idea (graphite, untinted, never struck, carried quietly); pen is a task. Ink it / Pencil it from a note's toolbar. Counts read "5 open · 3 ideas · 2 done".
- **Fold till later**: W (or the calendar button) on a thought: Today, Tomorrow, This weekend, or a date. It folds out of sight ("Folded till Sat · Undo") and appears on that day's paper marked with its day; "N folded for later" lists them. The 9 PM email lists the next 7 days under "Coming up".
- **Crumple**: ✕, Delete, swipe left, or the editor all crumple (with a 6-second Undo). Crumpled thoughts are hidden everywhere and swept up for good after 7 days by the nightly cron.
- **Clear desk** (`/drop/clear`, Shift+C, or the 9 PM email's button): each open task, one card at a time: Tomorrow (T), Keep as idea (K), Crumple (X), Done already (D), ← Back; swipes on a phone. Ends with a DESK CLEARED stamp, also shown on that day in History.
- **Handwriting**: notes in Kalam (the most legible of Caveat, Kalam, Patrick Hand, Gochi Hand and Nanum Pen Script at 18–24px; Caveat stays for headings), with a tiny per-word wobble seeded per note, ink write-on when dropped, paper grain, and Telugu (Gurajada) / Hindi (Kalam) handwriting.
- **Keyboard first**: Space, or simply typing, opens the writer from anywhere on the page (the first letter goes in); Enter drops; Esc closes.
- **Phone**: the canvas becomes a vertical stream with the same input.
- Sign-in required: signed-out visits go to `/signup?next=/drop`.

Shared canvas pieces (bubble looks, the dotted sheet, the interactive thought bubble) live in `src/components/canvas` so the team module can use them too.

## Run it locally

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL, BETTER_AUTH_SECRET, …
npm run db:migrate              # create tables on your database
npm run seed -- you@example.com # optional: a week of Drop papers for that email
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
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Sign-in links, invites, the daily papers. `EMAIL_FROM`'s domain must be verified in Resend. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | "Continue with Google". Redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`. |
| `CRON_SECRET` | production | Vercel Cron sends it to `/api/cron/drop-digest`. `openssl rand -hex 24`. |
| `DROP_TIMEZONE` | optional | Drop's day boundaries (default `Asia/Kolkata`). The cron time in `vercel.json` is fixed to 9 PM IST; change both together. |
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

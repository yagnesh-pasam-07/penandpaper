# Pen & Paper: product memory

What we decided, and why. Two parts:

1. **Current truth**: the decisions in force today, short and grouped. Read this first.
2. **Decision log**: every decision, newest first, with its date and reason. Append only: a change gets a new entry that says what it replaces; old entries are never edited or deleted.

**Rule for every change (people and coding agents alike):** a new feature, a removed feature, or a product, design, tech or security choice adds one log entry here, *and* updates "Current truth" if it changes what is true now. Same commit as the code.

Entry format:

```
### YYYY-MM-DD HH:MM IST · <area> · <one-line decision>
Why: <the reason, in a sentence or two>
Replaces: <earlier entry's date + title, or "nothing">
Commit: <short hash, once committed>
```

Areas: `product` · `design` · `tech` · `security` · `infra` · `growth`.

---

## Current truth

### Product
- **What it is:** one calm paper for the thoughts you don't have time to write. Personal, not a team planner (the team planner is parked; its routes redirect to `/drop`).
- **The core loop:** drop a thought in a second (type, paste, speak, share, highlight) → see it on one canvas → close the day with Tonight's paper → a 9 PM email of what you dropped.
- **Papers:** you make as many as you like; captures land on the paper you touched last. Library and search across all of them.
- **Capture surfaces:** the web canvas, the quick box (`/capture`), phone share (`/share`), the Chrome & Edge extension, the Mac menu-bar app. Each tags its thoughts by id prefix (`ext-`, `mac-`, `cap-`, `share-`), which Studio counts.
- **Extension:** highlight on any site and click the icon (or ⌥⇧P / Alt+Shift+P): the words, the first picture in the highlight and the page address go straight to the paper. No window.
- **Language:** English only in the interface and for voice, for now. Thoughts in any script still display correctly.
- **Windows:** no native app yet; the installable web app and the extension stand in.

### Design
- Paper, ink and one red. Handwritten headings. Notes in one of two fonts, chosen per user in Settings: **Handwritten** (Kalam, the default, for loose thinking) or **Clear** (Inter, medium weight, so a thought reads like a decision you'll remember).
- Minimal and calm: one idea per screen, quiet controls, no clutter. Menus are short and grouped.
- The paper header sits above the canvas; notes slide under it, never over it.
- Keys are shown in the visitor's own system (⌥ on Mac, Alt on Windows).

### Tech
- Next.js 16 on Vercel (`sin1`), Neon Postgres, Drizzle, Better Auth.
- Sign in: email + password, email link, and Google, Apple, Microsoft (each appears only when its keys are set).
- Pictures are small WebP data URLs in the database (to be moved to object storage, see open questions).
- Every schema change is a Drizzle migration in `drizzle/`. Production applies them automatically at the start of each deploy (`scripts/migrate-on-deploy.mjs`); locally, run `npm run db:migrate`.
- Pushing to `main` deploys to production. Migrations must only add (columns with defaults, new tables) so old and new code both run while a deploy rolls out.

### Security
- Roles: `user` (everyone) and `admin` (one person: `yagnesh@tilicho.in`). Set by a migration or `npm run set-role`, never by the app, and always by exact email, never by name.
- Studio (`/studio`) needs both the admin role and `STUDIO_PASSCODE`. No secret lives in the code.
- The server fetches pictures and link previews only from public addresses, never with the visitor's cookies.

### Open questions
- Move pictures out of the database into object storage (the biggest cost and speed risk as usage grows).
- Sharing a paper (read-only link) and connecting thoughts: proposed, not built.
- A universal (Apple silicon + Intel) Mac build: possible, untested on Intel.

---

## Decision log

### 2026-10-30 08:35 IST · security · The admin is one exact email: yagnesh@tilicho.in
Why: a name can be chosen by anyone who signs up; an email can't. Applied to production by migration `0013_yagnesh_admin.sql`; studio still needs the passcode.
Replaces: promoting every account whose name or email contains "yagnesh" (tried locally, never shipped)

### 2026-10-30 08:30 IST · design · The second note font is "Clear" (Inter), for remembering
Why: people who rely on their notes (founders, startup ideas) need each thought to stand out and stick on a quick reread. Inter at medium weight with tight spacing reads like a decision. Handwritten stays the default for loose thinking. The stored id stays `clean`, so earlier choices still apply.
Replaces: 2026-10-30 07:15 · "Clean" (Noto Sans)

### 2026-10-30 08:15 IST · infra · Production deploys migrate the database first
Why: pushing to main auto-deploys, and the new code went live before the production database had `users.role`, so every signed-in page failed. Now `npm run build` runs `scripts/migrate-on-deploy.mjs` first on Vercel production; if a migration fails, the build fails and the old version stays live.
Replaces: running `npm run db:migrate` by hand before deploying

### 2026-10-30 08:00 IST · product · Keep this file as the product's memory
Why: decisions were scattered across chat and commits; one file lets anyone (or any agent) learn why things are the way they are.
Replaces: nothing

### 2026-10-30 07:55 IST · infra · Migrate the database before deploying code that needs it
Why: the session started reading `users.role` before the column existed and every signed-in page failed locally ("The ink smudged"). Running `npm run db:migrate` fixed it.
Replaces: nothing

### 2026-10-30 07:45 IST · security · Studio behind two locks: admin role + passcode
Why: a leaked passcode alone, or a borrowed admin session alone, must not open analytics. Role is a `users.role` column (`user` | `admin`), changed only by script. The passcode lives in `STUDIO_PASSCODE`, not in the code.
Replaces: 2026-10-30 · `/admin` behind a passcode only
Commit: e9f6ae1

### 2026-10-30 07:45 IST · product · Studio answers one question: is it becoming a habit?
Why: vanity totals don't guide decisions. The page leads with people, active today/week, thoughts per active person, a 30-day pulse, where thoughts come from, return rate and monthly growth.
Replaces: nothing
Commit: e9f6ae1

### 2026-10-30 07:30 IST · design · Account menu: short, grouped rows
Why: a long two-line item and a duplicate "Download" made it look clumsy. Now: account · My paper / Library / Settings / Studio · Get the apps / Install · Sign out.
Replaces: nothing
Commit: e9f6ae1

### 2026-10-30 07:25 IST · design · The paper header sits on its own layer above the canvas
Why: notes dragged or panned to the top covered the logo and paper name. The header is sticky and frosted, so notes slide under it; dragging stays free.
Replaces: nothing
Commit: e9f6ae1

### 2026-10-30 07:20 IST · product · English only, for now
Why: focus. Hindi and Telugu were removed from the voice picker and copy; the fonts stay so existing thoughts in those scripts still display.
Replaces: Hindi and Telugu voice (2026-10-29)
Commit: e9f6ae1

### 2026-10-30 07:15 IST · design · A second note font, "Clean" (Noto Sans), per user
Why: some people want neutral, highly readable notes; Noto covers every script. Only the notes change; headings stay handwritten. Saved on the account (`drop_prefs.note_font`).
Replaces: nothing
Commit: e9f6ae1

### 2026-10-30 07:10 IST · product · Sign in with Google, Apple and Microsoft
Why: people trust the accounts they already have; it is faster than a password. Each button shows only when its keys are set, so nothing half-works.
Replaces: nothing
Commit: e9f6ae1

### 2026-10-30 07:00 IST · design · Windows and Mac treated equally
Why: keys shown per system; Windows visitors see the extension and the installable app first; Edge and "Extract All" are in the steps; the Mac app states it needs Apple silicon.
Replaces: nothing
Commit: e9f6ae1

### 2026-10-30 06:50 IST · product · A `/download` page, linked from home, the header, the menu and Settings
Why: the extension and the Mac app were invisible. Files are served from the site (`public/downloads/`, built by `scripts/build-downloads.sh`).
Replaces: nothing
Commit: e9f6ae1

### 2026-10-30 06:40 IST · product · Highlight + click saves straight to the paper, picture included
Why: the moment of noticing something is short; a window or a menu loses it. The server fetches the picture because the extension can't read other sites' images.
Replaces: right-click opening a small save window
Commit: e9f6ae1

### 2026-10-29 · product · Tonight's paper, an evening review ritual
Why: capture without review becomes a pile; one minute at night keeps it a paper.

### 2026-10-29 · product · Capture from anywhere: installable app, share target, extension, Mac app, voice
Why: a thought arrives wherever you are; the paper should be one keystroke away.

### 2026-10-28 · product · From to-do tool to papers you make
Why: numbering, stacks and scheduling made it a task manager. It is a place to put thoughts down: papers, a library and search.
Replaces: numbering, stacks, scheduling (2026-10-19 to 2026-10-21)

### 2026-10-19 · design · Hand-drawn, imperfect paper feel
Why: it should feel like paper, not software: imperfect bubble outlines, a pen-line strike, handwriting.

### 2026-10-18 · product · Pen & Paper starts as Drop, a personal brain-dump paper
Why: the original idea, a team planner, is parked; the personal paper is the product.

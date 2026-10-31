# Pen & Paper: product memory

The one place for product knowledge: what Pen & Paper is, what we decided and why, and how to decide the next thing. Five parts:

0. **Vision**: why it exists and where it is going.
1. **Current truth**: the decisions in force today, short and grouped. Read this first.
2. **Decision tree**: the questions to walk through before adding or changing anything.
3. **Feature tickets**: every feature asked for, with its state and its GitHub issue.
4. **Decision log**: every decision, newest first, with its date and reason. Append only: a change gets a new entry that says what it replaces; old entries are never edited or deleted.

**Rule for every change (people and coding agents alike):** a new feature, a removed feature, or a product, design, tech or security choice adds one log entry here, *and* updates "Current truth" if it changes what is true now, *and* adds or moves its row in "Feature tickets". Walk the decision tree first. Same commit as the code.

Entry format:

```
### YYYY-MM-DD HH:MM IST · <area> · <one-line decision>
Why: <the reason, in a sentence or two>
Replaces: <earlier entry's date + title, or "nothing">
Commit: <short hash, once committed>
```

Areas: `product` · `design` · `tech` · `security` · `infra` · `growth`.

---

## Vision

**First, people put thoughts down on paper. Pen & Paper is pen and paper, digitally.** It keeps paper's freedom (write anywhere, draw an arrow, tape in a picture, no setup) and fixes what paper loses: you can find any word, close the day in a minute, and your thoughts come back when they matter. The aim is a tool better than a pen and a sheet of paper. We value people's thoughts: nothing gets in their way, and nothing is lost.

**Where it sits:** a *personal thinking canvas with a daily rhythm*. Whiteboards (Excalidraw, tldraw, Miro, FigJam, Freeform) have the canvas but no memory; to-do apps (Things, Todoist) have the rhythm but no canvas; card-and-link tools (Heptabase, Obsidian Canvas) are for research, not today. Pen & Paper is the only one with all three: capture in a second, a free canvas, and thoughts that come back.

**Guardrails:** three tools, not thirteen (Select, Text, Draw, plus the eraser). Voice is first-class (hold Space and talk onto the paper). Calm by default: no shapes palette, no templates, no streaks.

**Next bets:** Apple Pencil and touch pen on iPad (literally better than paper); connected thoughts in Tonight's paper ("these three are one idea").

---

## Current truth

### Product
- **What it is:** one calm paper for the thoughts you don't have time to write. Personal, not a team planner (the team planner is parked; its routes redirect to `/drop`).
- **The core loop:** drop a thought in a second (type, paste, speak, share, highlight) → see it on one canvas → close the day with Tonight's paper → a 9 PM email of what you dropped → **the thought comes back**: the **Thought of the Day** and the whole week in Sunday's rewind (`/rewind`). Quiet by design: no streaks or badges, and it can be switched off in Settings.
- **Thought of the Day** (the recall, from the PRD "Drop + One Thought a Day"): the first time you open your paper after your recall time (default **9 AM**, your own zone), one past thought greets you full screen on a fresh sheet, "You wrote this 12 days ago", with the **signature sound** (a pen tap and one soft bell, 1.4 s, the same every day). Two choices: **Use it** (a copy lands on today's paper, the original leaves rotation) or **Tomorrow** (comes back later, spaced 1 → 3 → 7 → 21 → 60 days). "Show another" allows up to 3 a day; Esc closes. It picks due thoughts oldest first, else a forgotten one older than a week, never one shown in the last day; pictures and written text count, struck ones don't. Opening it on one device marks the day seen everywhere. Settings: on/off, time (7 AM, 9 AM, 1 PM, 9 PM, any time, or "only when I open the app"), days of the week, sound on/off, and **notify this device** (web push to desktop browsers, the phone's Home Screen app and the extension's browser). Notifications go out once a day from the 9 AM IST job, and the 9 PM job sends any that came due since (Vercel Hobby allows one run a day per job). Push needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (`npm run vapid`); without them the in-app greeting still works.
- **Papers:** you make as many as you like; captures land on the paper you touched last. Library and search across all of them.
- **Two kinds of thought:** a **to-do** (a note with words, links, videos) can be struck with the red pen, is reviewed in Tonight's paper and comes back in the morning. A **drop** (anything with a picture, and text written straight on the paper) is kept just to look at: no tick, no strike, not in Tonight's paper or the morning resurface. It can still be moved, edited, zoomed and crumpled. Which kind is decided by what it is, not chosen (`isDrop` in `src/modules/drop/logic.ts`).
- **Canvas tools** (desktop, a bar at the top; keys 1–4, Esc back to Select): **Select** (move, edit, arrange; drag bare paper to pan), **Text** (click anywhere and write straight on the paper: no card, Enter is a new line, Esc or a click away puts the pen down; written text is a drop), **Draw** (freehand ink; a line that starts on one thing and ends on another is a **connector** with an arrowhead and follows both when they move; a line that starts and ends on the same thing is a mark on it), **Eraser** (press or rub over a line, with Undo). Letters are left for typing, which still opens the writer. The phone keeps the simple stream.
- **Voice, hold to talk** (like Claude's CLI): in any text box (text on the paper, the writer) a tap of Space is a space; **held**, it listens until you let go, takes back the spaces the key typed, shows the words as they're heard and puts them in at the cursor. A **mic** sits beside the cursor for speaking without holding. On bare paper, tap Space for the writer; hold it and the words land as text where the pointer is. Uses the browser's own recogniser (no key), listening continuously while held so a pause doesn't cut it off.
- **The paper has no header bar:** the logo and paper name float top-left, search, Library and the account top-right, the tools top-centre, and the canvas runs to the top of the screen. Other pages (library, settings, rewind) keep the bar.
- **Capture surfaces:** the web canvas, the quick box (`/capture`), phone share (`/share`), the Chrome & Edge extension, the Mac menu-bar app. Each tags its thoughts by id prefix (`ext-`, `mac-`, `cap-`, `share-`), which Studio counts.
- **Extension:** highlight on any site and click the icon (or ⌥⇧P / Alt+Shift+P): the words, the first picture in the highlight and the page address go straight to the paper. No window.
- **Language:** English only in the interface and for voice, for now. Thoughts in any script still display correctly.
- **Windows:** no native app yet; the installable web app and the extension stand in.

### Design
- Paper, ink and one red. Handwritten headings. Notes in one of two fonts, chosen per user in Settings: **Handwritten** (Kalam, the default, for loose thinking) or **Clear** (Inter, medium weight, so a thought reads like a decision you'll remember).
- Minimal and calm: one idea per screen, quiet controls, no clutter. Menus are short and grouped.
- The paper header sits above the canvas; notes slide under it, never over it.
- Keys are shown in the visitor's own system (⌥ on Mac, Alt on Windows).
- Logo: a ruled sheet with the red fountain-pen nib, in `public/brand/` (see its README). The favicon is the nib alone.

### Tech
- Next.js 16 on Vercel (`sin1`), Neon Postgres, Drizzle, Better Auth.
- Sign in: email + password, email link, and Google, Apple, Microsoft (each appears only when its keys are set).
- Email: Brevo (free, no domain needed) or Resend, whichever key is set, with `EMAIL_FROM`. Nothing sends until one is set.
- Pictures are small WebP data URLs in the database (to be moved to object storage, see open questions).
- Every schema change is a Drizzle migration in `drizzle/`. Production applies them automatically at the start of each deploy (`scripts/migrate-on-deploy.mjs`); locally, run `npm run db:migrate`.
- Pushing to `main` deploys to production. Migrations must only add (columns with defaults, new tables) so old and new code both run while a deploy rolls out.

### Security
- Roles: `user` (everyone) and `admin` (one person: the maintainer). Set by a migration or `npm run set-role`, never by the app, and always by exact email, never by name.
- Studio (`/studio`) needs both the admin role and `STUDIO_PASSCODE`. No secret lives in the code.
- New accounts must use an address that can receive mail: typos (with a "Did you mean …?" fix), throwaway inboxes and domains with no mail server are refused on the server. With an email service set (`RESEND_API_KEY` + `EMAIL_FROM`), a password sign-up must also click a confirmation link before it can sign in.
- The server fetches pictures and link previews only from public addresses, never with the visitor's cookies.

### Open questions
- Move pictures out of the database into object storage (the biggest cost and speed risk as usage grows).
- Sharing a paper (read-only link) and connecting thoughts: proposed, not built.
- A universal (Apple silicon + Intel) Mac build: possible, untested on Intel.
- Recall time default: 9 AM (start of making) or 9 PM (evening review)? Started at 9 AM; test both.
- A truly custom notification sound when the app is closed needs a native app (browsers play the device's own sound); the Mac app could do it.
- Exact-time notifications need an hourly job (Vercel Pro); today they arrive at 9 AM or 9 PM IST, whichever comes first after the chosen time. The in-app greeting is always on time.
- Drops: should a person be able to turn a picture into a to-do (or words into a drop) by hand? Not yet: see the decision tree, step 3.

---

## Decision tree

Walk this before building anything. Each answer either stops you or sends you to the next step, and the answers go in the decision-log entry.

```
1. Does it serve the core loop?  (drop it fast → see it → close the day → it comes back)
   ├─ No  → Park it under "Open questions". Stop.
   └─ Yes ↓
2. Does it add a screen, a setting, a button or a notification?
   ├─ Yes → Can it be decided from what the person already did, with nothing new to choose?
   │        ├─ Yes → Do that instead (calm by default: fewer controls).
   │        └─ No  → Keep it, but one control, in an existing menu. ↓
   └─ No  ↓
3. Does it change what a thought IS (its kind, or what strike / keep / crumple mean)?
   ├─ Yes → Check every place a thought is acted on:
   │        the canvas, Tonight's paper, the morning resurface, Sunday's rewind,
   │        the 9 PM email, search, the extension, the Mac app, the homepage try-it.
   │        Enforce it on the server too, not only in the UI. ↓
   └─ No  ↓
4. Does it need a database change?
   ├─ Yes → Can it be worked out from columns we already have?
   │        ├─ Yes → Work it out (no migration).
   │        └─ No  → An add-only Drizzle migration (new column with a default, or a new table). ↓
   └─ No  ↓
5. Could it lose or hide someone's words, or expose them?
   ├─ Yes → Add an Undo, keep data 7 days, and note it under "Security". ↓
   └─ No  ↓
6. Ship it: tests + PRODUCT.md (log entry, Current truth, Feature tickets row) in the same pull request.
```

---

## Feature tickets

Every feature asked for, newest first. One row each; move its state as it goes. The GitHub issue holds the discussion.

| Feature | State | Ticket |
| --- | --- | --- |
| Thought of the Day: one past thought a day, full screen, signature sound, recall time, notifications on every device | Shipped | [#34](https://github.com/yagnesh-pasam-07/penandpaper/issues/34) |
| Hold Space to talk in any text box (like Claude's CLI), a mic by the cursor, no header bar on the paper | Shipped | [#33](https://github.com/yagnesh-pasam-07/penandpaper/issues/33) |
| Canvas tools: Select, Text, Draw (with connectors), Eraser; hold Space to speak; "pen & paper, digitally" homepage | Shipped | [#31](https://github.com/yagnesh-pasam-07/penandpaper/issues/31) |
| Drops vs to-dos: a picture is a drop, with no tick or strike, and stays out of the review | Shipped | [#29](https://github.com/yagnesh-pasam-07/penandpaper/issues/29) |

---

## Decision log

### 2026-10-31 17:00 IST · product · Thought of the Day replaces the morning card: one past thought, full screen, with a signature sound
Why: people capture everywhere but never recall (the PRD's problem). The morning card was small, had four buttons and left pictures out. Now one past thought greets you full screen at your chosen time, like a letter from your past self, with two choices (Use it, Tomorrow), a once-a-day sound, and a notification on every device you turn on. Decision tree: it is the "it comes back" step of the core loop (step 1); one thought, one sound, two buttons, a time and days in Settings, with no per-thought alarms (step 2: calm by default); "Use it" copies the thought onto today's paper rather than striking it, because a maker uses raw material, it doesn't finish it, and pictures and written text can come back (step 3); one add-only migration: recall settings on `drop_prefs`, `drop_thoughts.recall_shown_at` and a `drop_push_subscriptions` table, reusing the resurface rhythm columns (step 4); the push endpoint must be a known push service over https, and the service worker caches nothing (step 5). Web push is built on Node's crypto (RFC 8291 and 8292, tested against the RFC's own vector) instead of a package. The signature sound is synthesised by `scripts/make-recall-sound.mjs`, so it is ours. Browsers only play a custom sound while the page is open; when it is closed, the device's own notification sound plays.
Replaces: 2026-10-30 11:30 · the morning resurface card (do it / keep / let go / not now on a 1 → 7 → 30 rhythm)

### 2026-10-31 15:00 IST · product · Hold Space to talk inside text, a mic by the cursor; the paper loses its header bar
Why: holding Space while writing text did nothing but move the cursor (the text box had the keyboard and typed spaces), and there was no way to speak into text being written. Now every text box works like Claude's CLI: a tap is a space, held (350 ms) it listens until released, the spaces the key repeat typed are taken back, and the words go in at the cursor; a mic button beside it does the same without holding. The recogniser listens continuously while held, so a pause mid-sentence doesn't end it (more of what was said gets through). The header bar on the paper is replaced by floating islands so the canvas runs to the top. Decision tree: it serves the loop (step 1: faster capture); no new setting (step 2); nothing about what a thought is changes (step 3); no migration (step 4).
Replaces: 2026-10-31 13:30 · hold Space speaks only on bare paper

### 2026-10-31 13:30 IST · product · Canvas tools: Select, Text, Draw (connectors) and an eraser; hold Space to speak
Why: the canvas only took notes, but thinking on paper is also writing in the margins and drawing arrows between ideas. Decision tree: it serves the loop (step 1: faster capture, clearer thinking); three tools plus an eraser, not a shapes palette, and a connector is just a line drawn from one thing to another, with no separate Connect tool (step 2: calm by default); text written on the paper is a drop, never a to-do, and lines are never reviewed, so Tonight's paper, the resurface, the 9 PM email and strike all skip them, enforced on the server (step 3); one add-only migration: `drop_thoughts.kind` (default `note`) and a new `drop_strokes` table (step 4); erasing keeps a line 7 days with an Undo, like crumpling (step 5). Tool keys are 1–4, not letters, because typing a letter already opens the writer. Hold Space (280 ms) speaks with the browser's recogniser; a tap still opens the writer.
Replaces: nothing

### 2026-10-31 13:30 IST · growth · The story: first on paper, now pen & paper, digitally
Why: the maintainer's framing of the product. The hero's line, the site description and a new "First, on paper. Now, pen & paper, digitally." section say it: keep paper's freedom, fix what paper loses. Vision section added above.
Replaces: the hero line "A paper for the thoughts you don't have time to write. Type it, paste it, or just say it."

### 2026-10-31 11:40 IST · product · Two kinds of thought: a picture is a drop, not a to-do
Why: every note behaved like a to-do, so a picture dropped just to see more clearly could be struck by a stray double-click, swipe or tick, and it showed up in Tonight's paper and the morning resurface asking to be "done". A picture is kept to look at. Decision tree: it serves the loop (step 1); it is decided from the content, with no new toggle (step 2: calm by default); it changes what a thought is, so the canvas loses the tick, double-click and swipe-to-strike for pictures, the API refuses to strike one, and Tonight's paper (cards and counts) and the resurface skip them (step 3); worked out from the existing `image` column, so no migration (step 4). Pictures already struck before this keep their line. A manual "make it a to-do" switch is left open.
Replaces: nothing (every thought was a to-do since 2026-10-18)

### 2026-10-31 11:40 IST · product · PRODUCT.md gains a decision tree and a feature-ticket list
Why: the maintainer wants every feature recorded here and a fixed set of questions for deciding changes, so this file holds the product knowledge, the decisions and how to make the next one. Each feature also gets a GitHub issue.
Replaces: nothing

### 2026-10-31 11:20 IST · design · A Pen & Paper logo for the repo, and an open-source README header
Why: the repo should read like an open-source project at a glance, the way RepoMind's does: a logo, a one-line pitch, links and badges at the top. The logo is a ruled sheet with the app's red fountain-pen nib finishing a line, in red, light and dark tiles plus bare marks (`public/brand/`), and `docs/social-preview.png` for link cards. The app's own favicon and install icons are unchanged. The README is now short and written for beginners (what it is, screenshots, a five-step quick start, how to contribute); the full feature and API reference moved unchanged to `docs/GUIDE.md`.
Replaces: nothing

### 2026-10-30 11:30 IST · tech · Email through Brevo or Resend, whichever is set
Why: Resend's free plan only emails anyone after you verify a domain you own, and the site is on vercel.app. Brevo's free plan (300 a day) sends to anyone after confirming one sender address. One HTTPS call, no new package.
Replaces: Resend only

### 2026-10-30 11:30 IST · product · Thoughts come back: the morning resurface and the Sunday rewind
Why: capture was strong but nothing came back, so there was no reason to return (13% came back after their first week). Each morning one open thought from 1, 7 or 30 days ago returns to the top of the paper: Do it (struck), Keep (later in the rhythm), Let go (stays, never returns), or Not now (tomorrow). `/rewind` shows the week grouped by paper, linked from Sunday's 9 PM email. Measured by Studio's week-1 retention. No streaks, badges or guilt; a switch in Settings turns it off.
Replaces: nothing

### 2026-10-30 10:45 IST · tech · The star count refreshes every two minutes, and again in the browser
Why: an hour-long cache showed 0 stars after the repo had 1, the first time anyone looked. Stars now have their own two-minute server cache (about 30 GitHub calls an hour, inside the 60 allowed without a token), and the button asks `/api/github/stars` once after the page loads, so a new star shows within minutes. Avatars and forks stay hourly.
Replaces: 2026-10-30 10:20 · stars cached for an hour with the rest

### 2026-10-30 10:20 IST · growth · Live GitHub stars and contributors on the homepage
Why: an open-source project grows by showing it is alive. A GitHub button with the live star count sits in the nav; "Built in the open." shows contributors' avatars, stars, forks and a way to contribute. Fetched on the server and cached for an hour, so visitors never call GitHub and its rate limit is never hit; if GitHub is down, the numbers simply don't show. Bots are left out.
Replaces: nothing

### 2026-10-30 09:55 IST · growth · Open source under MIT; only the maintainer merges to main
Why: anyone can read, fork and contribute; quality stays in one pair of hands. `main` is protected: every change is a pull request that passes CI and gets the maintainer's approval (CODEOWNERS). Contributor guide, security policy, code of conduct and templates are in the repo. The admin's email was taken out of the files before going public.
Replaces: nothing

### 2026-10-30 09:40 IST · product · Studio rebuilt like YouTube Studio: growth, realtime, insights
Why: the first version showed totals, not decisions. Now: a Studio brand bar; four headline numbers (writers, thoughts, new people, thoughts per writer), each with ▲/▼ change against the previous 28 days; a tabbed daily chart; Realtime (online now, from a once-a-minute ping while a paper is visible: `users.last_seen_at`); Insights in plain words with what to do; the journey (activation, week-1 retention, slipping, never wrote); sources; when people think (day and hour); monthly; people with online status and verification.
Design: numbers in Inter with tabular figures (no handwriting in Studio); one validated blue for data; green/red only for growth, always with an arrow.
Replaces: 2026-10-30 07:45 · Studio's first layout

### 2026-10-30 09:20 IST · security · Refuse sign-ups from addresses that can't receive mail; verify when email is on
Why: broken and fake emails (typos, throwaway inboxes) can't get sign-in links and pollute the numbers. Checked in the browser for a quick fix and enforced on the server for every new account. Verification links need an email service, which production doesn't have yet, so they switch on by themselves once `RESEND_API_KEY` and `EMAIL_FROM` are set; turning them on without one would lock everyone out.
Replaces: nothing

### 2026-10-30 08:55 IST · growth · The homepage shows highlight-to-save and the two fonts
Why: the two features that most set it apart were invisible to visitors. "Read something good? Highlight it." shows a highlighted line becoming a note; "Think loose. Read it clear." shows one thought in both fonts.
Replaces: a single line about the extension above the download button

### 2026-10-30 08:35 IST · security · The admin is one exact email, the maintainer's
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

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

**Guardrails:** four tools, not thirteen (Select, Text, Draw, Shape, plus the eraser). Five ink colours, never a colour wheel. Two shapes (rectangle, ellipse), never a shapes palette. Voice is first-class (hold Space and talk onto the paper). Calm by default: no templates, no streaks.

**The brand:** Pen & Paper is the website, the thinking app, **Stories** (real human stories, history and art, read slowly or listened to), and a shop later. The app is private; Stories are public. They share the brand and the look, never data.

**Next bets:** Apple Pencil and touch pen on iPad (literally better than paper); connected thoughts in Tonight's paper ("these three are one idea").

---

## Current truth

### Product
- **What it is:** one calm paper for the thoughts you don't have time to write. Personal, not a team planner (the team planner is parked; its routes redirect to `/drop`).
- **The core loop:** drop a thought in a second (type, paste, speak, share, highlight) → see it on one canvas → close the day with Tonight's paper → a 9 PM email of what you dropped → **the thought comes back**: the **Thought of the Day** and the whole week in Sunday's rewind (`/rewind`). Quiet by design: no streaks or badges, and it can be switched off in Settings.
- **Thought of the Day** (the recall, from the PRD "Drop + One Thought a Day"): the first time you open your paper after your recall time (default **9 AM**, your own zone), one past thought greets you full screen on a fresh sheet, "You wrote this 12 days ago", with the **signature sound** (a pen tap and one soft bell, 1.4 s, the same every day). Two choices: **Use it** (a copy lands on today's paper, the original leaves rotation) or **Tomorrow** (comes back later, spaced 1 → 3 → 7 → 21 → 60 days). "Show another" allows up to 3 a day; Esc closes. It picks due thoughts oldest first, else a forgotten one older than a week, never one shown in the last day; pictures and written text count, struck ones don't. Opening it on one device marks the day seen everywhere. Settings: on/off, time (7 AM, 9 AM, 1 PM, 9 PM, any time, or "only when I open the app"), days of the week, sound on/off, and **notify this device** (web push to desktop browsers, the phone's Home Screen app and the extension's browser). Notifications go out once a day from the 9 AM IST job, and the 9 PM job sends any that came due since (Vercel Hobby allows one run a day per job). Push needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (`npm run vapid`); without them the in-app greeting still works.
- **Papers:** you make as many as you like; captures land on the paper you touched last. Library and search across all of them.
- **Two kinds of thought:** a **to-do** (a note with words, links, videos) can be struck with the red pen, is reviewed in Tonight's paper and comes back in the morning. A **drop** (anything with a picture, and text written straight on the paper) is kept just to look at: no tick, no strike, not in Tonight's paper or the morning resurface. It can still be moved, edited, zoomed and crumpled. Which kind is decided by what it is, not chosen (`isDrop` in `src/modules/drop/logic.ts`).
- **Canvas tools** (desktop, a bar at the top; keys 1–5, Esc back to Select): **Select** (a click *picks*: written text gets an outline and a corner to drag bigger or smaller, 14–96 px in 2 px steps, Shift for any size; a line or shape gets an outline, a shape four corners to reshape; double-click or Enter edits; Delete rubs out a picked line; drag a note to move it; drag bare paper to pan), **Text** (click anywhere and write straight on the paper: no card, Enter is a new line, Esc or a click away puts the pen down; the hint shows only on fresh text; written text is a drop), **Draw** (freehand ink; a line that starts on one thing and ends on another is a **connector** with an arrowhead and follows both when they move; a line that starts and ends on the same thing is a mark on it), **Shape** (drag a rectangle or an ellipse, Shift for a square or circle, 4 again switches; hand-drawn edges; double-click with Select to write inside), **Eraser** (press or rub over a line or shape, with Undo). Letters are left for typing, which still opens the writer. The phone keeps the simple stream.
- **A ring holds things:** a loop drawn round notes (a line that comes back near its start) or a shape is a group. Carry it with Select and everything whose centre is inside moves with it, free lines inside too, connectors follow; each thing inside can still be picked and moved alone. Nothing is stored about the group: it's worked out from where things are when you pick it up.
- **Five inks:** Ink, Vermilion (urgent), Cobalt (a decision), Viridian (done), Saffron (an idea). The dots show in the tool bar while drawing, writing or with something picked (it takes the colour). Kept by name, so they re-colour with the theme (THEME.md). The pen's colour and shape are remembered on the device.
- **Dates and reminders on to-dos** (like Slack): a clock on a to-do opens Today / Tomorrow / Next Monday / In an hour, or a day and an optional time. The note shows a chip ("Today, 6:00 PM"), amber when soon, red when late. With a time, it reminds: on the minute while the paper is open (a toast, or a browser notification if the tab is hidden), otherwise by web push, or email if no device has notifications, from the 9 AM and 9 PM IST jobs (Hobby allows one run a day per job; `/api/cron/reminders` is ready to run hourly on Pro). Once per date; changing the date re-arms it. Drops never take a date (enforced on the server).
- **Sharing a paper** (Share, top right): invite by email (they sign in with that address and see it read-only at `/drop/shared/<id>`; an email tells them), or turn on **Anyone with the link** (off by default; `/p/<random token>`, read-only, no sign-in, `noindex`; off kills it at once; "Make a new link" replaces it). Shared readers see the notes, text, lines and shapes, the owner's first name, never due dates, other papers or the owner's email. 20 invites a day.
- **Mentions:** typing `@` in written text suggests the people this paper is shared with; mentioning one emails them the line. Writing `@name@company.com` for someone not on it offers "Share this paper with them?" (one tap invites, view only). A mention never shares by itself.
- **Writing on the paper** (see the PRD below): `/` offers To-do, Remind me, Heading, List, Mention someone. Written text becomes a to-do with a hand-drawn box (`[ ] ` or the To-do chip on picked text) and counts as a to-do everywhere. "… remind me tomorrow at 5" sets the reminder as you write. **⌘Z / ⇧⌘Z** (Ctrl+Z / Ctrl+Y) undo and redo every change on the paper this visit.
- **Voice, hold to talk** (like Claude's CLI): in any text box (text on the paper, the writer) a tap of Space is a space; **held**, it listens until you let go, takes back the spaces the key typed, shows the words as they're heard and puts them in at the cursor. A **mic** sits beside the cursor for speaking without holding. On bare paper, tap Space for the writer; hold it and the words land as text where the pointer is. Uses the browser's own recogniser (no key), listening continuously while held so a pause doesn't cut it off.
- **The paper has no header bar:** the logo and paper name float top-left, search, Library and the account top-right, the tools top-centre, and the canvas runs to the top of the screen. Other pages (library, settings, rewind) keep the bar.
- **Capture surfaces:** the web canvas, the quick box (`/capture`), phone share (`/share`), the Chrome & Edge extension, the Mac menu-bar app. Each tags its thoughts by id prefix (`ext-`, `mac-`, `cap-`, `share-`), which Studio counts.
- **Extension:** highlight on any site and click the icon (or ⌥⇧P / Alt+Shift+P): the words, the first picture in the highlight and the page address go straight to the paper. No window.
- **Language:** English only in the interface and for voice, for now. Thoughts in any script still display correctly.
- **Windows:** no native app yet; the installable web app and the extension stand in.

### Stories (public)
- **What:** real human stories, history and art, written by the admin in Studio, read or heard by anyone at `/stories` (no account). Made for one hand on a phone in the metro, an auto driver who listens, and someone after a bad day. No likes, comments, counts or popups.
- **Reading page** (`/stories/[slug]`): Newsreader serif at 20–21 px, about 65 characters a line, warm paper and ink (dark mode), drop cap, red pull quotes, pictures with captions and artist credit. Pictures are offered at 480/960/1600 px as WebP and lazy-loaded (a phone on 4G loads a 7 KB cover, not 84 KB).
- **Listen:** only when the writer recorded their own voice (no text-to-speech). A real `<audio>` with lock-screen controls (Media Session), served with byte ranges so iPhone can seek and keep playing with the screen off.
- **Writing** (`/studio/stories`): behind Studio's two locks (admin role + passcode), checked on the server for every save and upload. A Medium-style editor: you type on a page that looks like the published one (Enter = paragraph, `## ` heading, `> ` quote, ⌘B/⌘I, + for a picture or break), it saves itself, Preview shows the real page, Publish is "now" or "schedule" (default next Sunday 9 AM). The address follows the title until first published, then never changes. A Medium post can be imported as a draft, pictures copied in.
- **Scheduling:** "scheduled" is a published story with `publish_at` ahead. Public pages are cached and re-checked every 15 minutes, so a scheduled story appears within 15 minutes of its time; publishing in Studio shows at once.
- **Discovery:** "This week's story" on the homepage (the newest one), Stories in the homepage nav, WhatsApp-first share, a per-story share image (~45 KB JPEG), `sitemap.xml`, `robots.txt`, `/stories/rss.xml`.
- **Real people, made trustworthy:** a story can name **the person** it is about (name, place, their real photo, never stock), with "✓ Shared with their permission" when they agreed; the byline then reads "Written by <writer>". History gets a numbered **Sources** box at the end (one per line, a line ending in a link becomes one). Stories can belong to a **series** (by name; its page is `/stories/series/<slug>`, stories in the order they came out; "More from <series>" at the end of each; a strip of series on `/stories`).
- **Telugu ⇄ English:** each story has a language; "Make a Telugu version" in Publish creates a draft copy (same pictures, person, series, sources) linked to the original. Once both are published, each shows a switch ("తెలుగులో చదవండి" / "Read in English") and declares the other with hreflang. Telugu is set in Noto Serif Telugu.
- **Claps rank the stories:** a reader taps as many times as a story moved them, up to 50 per story (like Medium), so one person can't push a story to the top alone. Each tap: a soft pen tap and a chime that climbs a pentatonic note each time (made live in the browser, no file), a short buzz on phones, a "+n" that floats up. On a phone a round clap floats bottom-right under the thumb (with the total), moves above the Listen bar, and steps aside when the big clap at the story's end is on screen; both share one count. `/stories` has **Newest | Most loved**; the homepage features the **most-loved story of the last 30 days** (the newest when nothing has claps). Cards show the clap total. Anonymous (same reader key as Studio), live stories only, rate-limited; the total on the story is kept in step with the per-reader rows in one statement.
- **Readers have an identity:** a clap carries a person, so **signing in is required to clap** (and to save); reading, listening and sharing stay open to everyone. Tapping clap while signed out plays the clap and opens a sheet: **Continue with Google** (shown only when Google keys are set) or email; it comes back to the same story and the clap is counted. Claps are tied to the account (one count across all devices, still at most 50); claps given anonymously on a browser carry over when that reader signs in. **Save for later** (bookmark in the byline) and `/stories/saved`. The stories header shows **Sign in**, or the reader's initial with Saved, Your paper, Sign out. Studio shows **who loved it** (signed-in clappers, most claps first). The server refuses anonymous claps and saves.
- **Story Studio** (`/studio/stories`, like YouTube Studio, writer only): per story, where readers stop (a bar per paragraph, the biggest drop marked), typical and finishers' active reading time, read-through by source, views, readers, read to the end, shares (by WhatsApp, Instagram, copy, phone share), listens, where readers came from (WhatsApp, Instagram, Google, home, direct) and phone vs computer, with a 28-day chart (`/studio/stories/[id]/reach`); totals across all stories at the top of the list. **Readers never see any count.** Anonymous: a random id the browser keeps (no cookie, no IP), keyed on the server; a view, read or listen counts once a day per reader; link-preview bots and crawlers are ignored; only live stories are counted. A "read" is reaching the last line after at least 20 seconds. Share links carry `?s=wa|ig|link` (WhatsApp strips the referrer), removed from the address bar on arrival. Clicking a published story opens its own page (Edit beside it); it leads with average attention, average % read, finished it and clapped, and a **Who clapped** list: every signed-in reader, their claps out of 50, email and when, plus people, claps each, how many gave all 50 and % of readers who clapped. The list shows claps and people per story. Every Studio page shares one frame: a left rail (Overview, Stories, each live story) and full-width content; tabs on a phone.
- **Sharing:** WhatsApp sends a warm message ("I read this and thought of you." by default, the writer can change it per story), the title, the hook and the link; the preview picture is the cover or a picture the writer picks. **Instagram:** a 1080×1920 story card (`/stories/[slug]/card`) sent through the phone's share sheet, downloaded on a computer. Then Copy link and the phone's own share.
- **Latest reads** on the homepage: the newest story large, the next three as cards.
- **Story files** (pictures, audio) are stored in Postgres in 1.5 MB parts (`story_media_parts`), the same "database for now" choice as the paper's pictures; moves with them to object storage.
- **Stories in Markdown files** (`content/stories/*.md`) go into Studio as drafts with `npm run story:add -- <file> <admin email>`; never published by the script.

### Design
- Paper, ink and one red. Handwritten headings. Notes in one of two fonts, chosen per user in Settings: **Handwritten** (Kalam, the default, for loose thinking) or **Clear** (Inter, medium weight, so a thought reads like a decision you'll remember).
- Minimal and calm: one idea per screen, quiet controls, no clutter. Menus are short and grouped.
- The paper header sits above the canvas; notes slide under it, never over it.
- Keys are shown in the visitor's own system (⌥ on Mac, Alt on Windows).
- Logo: a ruled sheet with the red fountain-pen nib, in `public/brand/` (see its README). The favicon is the nib alone.
- Homepage only: behind the headline, a faint strip of everything that changes (fire to the galaxy, 25 freely licensed pictures in `public/timeline/`, including the makers the founder looks up to: da Vinci, Shakespeare, Nolan, Rajamouli, Keeravani, Naval Ravikant), black and white, blurred, ~10% opacity, drifting one loop every 90 s, still for reduced motion. Faith images sit together, away from war. Credits at `/credits`.

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
- Shared papers: every read checks the share on the server (the invited email, signed in; or the public token while the link is on), so removing a person or turning the link off works on the next request. Public tokens are 128-bit random, never the paper id, and the pages are `noindex`. Shared views hide due dates and the owner's email. Invites are rate-limited (20 a day per person) and go to checked, deliverable addresses only. Nothing is ever shared from a mention without a tap.

### Open questions
- Stories: more writers (`author_id` is there), "Submit a human" (readers nominate a person), a Sunday-morning newsletter, and a "Write it on paper" loop back into the app. Not built yet.
- Story audio up to 40 MB lives in Postgres today; move to object storage (Vercel Blob) once there are more than a handful of recordings.
- Move pictures out of the database into object storage (the biggest cost and speed risk as usage grows).
- Connecting thoughts: proposed, not built. Shared papers are view-only; editing together (live cursors) is the next step if people ask.
- Mentions by plain `@handle` need usernames on accounts; today a mention is an email.
- A universal (Apple silicon + Intel) Mac build: possible, untested on Intel.
- Recall time default: 9 AM (start of making) or 9 PM (evening review)? Started at 9 AM; test both.
- A truly custom notification sound when the app is closed needs a native app (browsers play the device's own sound); the Mac app could do it.
- Exact-time notifications need an hourly job (Vercel Pro); today they arrive at 9 AM or 9 PM IST, whichever comes first after the chosen time. The in-app greeting is always on time.
- Drops: should a person be able to turn a picture into a to-do (or words into a drop) by hand? Not yet: see the decision tree, step 3.


---

## PRD: writing on the paper, the five verbs (2026-11-02)

**Problem.** People plan real projects on the paper (a column per person, rings round what matters, arrows to the next step). Writing there was slow to structure: a thought couldn't become a to-do, a reminder needed the mouse, nobody could be pulled in, and nothing could be undone. Slack canvas, Notion and Things solve this with a `/` menu of thirty blocks. That turns a paper into a document editor, which is the opposite of what we are.

**First principles.** A thinker with a pen does five things to words, and nothing else: **decide** (this is a to-do), **remember** (bring it back at a time), **structure** (a heading, a list), **involve** (this is for someone), and **take back** (undo). Everything else (tables, columns, code, embeds) is layout or storage, and the free canvas already *is* the layout. So: five verbs, each one reachable three ways (typed naturally, from `/`, or with a click), and never a new screen.

**What we build**
| Verb | Typed | `/` menu | Click |
| --- | --- | --- | --- |
| Decide | `[ ] ` at the start | To-do | "To-do" chip on picked text |
| Remember | `… remind me tomorrow at 5` | Remind me | clock / "+ Date · remind me" |
| Structure | `• ` (Enter continues the list) | Heading, List | drag the corner to resize |
| Involve | `@` suggests people on the paper | Mention someone | Share |
| Take back | ⌘Z / ⇧⌘Z (Ctrl+Y) | | Undo in the toast |

- A written to-do keeps its handwriting: a small hand-drawn box in the text's own ink, a red pen tick, the words struck. It counts as a to-do everywhere (Tonight's paper, the morning recall, reminders, strike), enforced on the server.
- "remind me" understands today, tonight, tomorrow, weekdays, "12 nov", "at 5", "5:30pm", morning/noon/evening and "in 20 minutes". A bare "remind me" is tomorrow 9 AM. The words keep everything before "remind me"; a toast says when, with Change.
- `@` suggests only people the paper is already shared with (name or email). Mentioning one emails them the line (40 a day). An email typed after `@` for someone not on the paper still only *offers* to share: a mention never shares by itself.
- Undo covers every change on the paper this visit (add, edit, strike, colour, size, date, move, tidy, crumple, draw, rub out, reshape, a ring and all it carries as one step), 100 steps, and works after the crumple has been sent.

**What we take from others, and what we leave**
- From **Slack canvas**: `/`, `@`, check lists, dates on a line. *Not* tables, columns, code blocks, video/audio clips, files, channels, profiles: layout and storage, not thinking. Voice is already first-class (hold Space).
- From **Things / Todoist**: natural-language dates ("remind me friday"). *Not* projects, areas, priorities or tags: the ring and the five inks already do that visually.
- From **Google Keep**: a to-do box that lives *in* the note, and time reminders. *Not* labels or pinned colours.
- From **Obsidian**: the idea that a mention is a link between thoughts. Back-links ("where else did I write about Teja?") are the next step, via search, not built yet.

**Not now, on purpose:** tables, embeds, file uploads, sub-tasks, assignees with permissions (a mention is enough), recurring reminders (open question).

**Success:** more to-dos written as text and ticked on the paper; reminders set by typing rather than the picker; fewer "undo" losses (crumple → undo within a visit).

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
| Writing on the paper: / menu, @ people, text → to-do, remind me, ⌘Z undo | Built | [#50](https://github.com/yagnesh-pasam-07/penandpaper/issues/50) |
| Mentions: @name@company.com offers to share the paper with them | Built (branch canvas-planning) | [#49](https://github.com/yagnesh-pasam-07/penandpaper/issues/49) |
| To-dos: a date and a reminder time (chip, push or email) | Built (branch canvas-planning) | [#48](https://github.com/yagnesh-pasam-07/penandpaper/issues/48) |
| Canvas: a ring round things holds them; carry it and everything inside moves | Built (branch canvas-planning) | [#47](https://github.com/yagnesh-pasam-07/penandpaper/issues/47) |
| Canvas: Select selects, double-click edits, drag a corner to resize text | Built (branch canvas-planning) | [#41](https://github.com/yagnesh-pasam-07/penandpaper/issues/41) |
| Canvas: five ink colours for day and night (Ink, Vermilion, Cobalt, Viridian, Saffron) | Built (branch canvas-planning) | [#42](https://github.com/yagnesh-pasam-07/penandpaper/issues/42) |
| Canvas: Shape tool (rectangle, ellipse), move, reshape, write inside, connect | Built (branch canvas-planning) | [#43](https://github.com/yagnesh-pasam-07/penandpaper/issues/43) |
| Paper: Share by email (private) or a public read-only link | Built (branch canvas-planning) | [#44](https://github.com/yagnesh-pasam-07/penandpaper/issues/44) |
| Canvas: 60 fps pan, zoom, drag and draw on desktop | Built (branch canvas-planning) | [#45](https://github.com/yagnesh-pasam-07/penandpaper/issues/45) |
| Canvas for project planning: frames, full undo, duplicate, status, export (roadmap) | Proposed | [#46](https://github.com/yagnesh-pasam-07/penandpaper/issues/46) |
| Story Studio: where readers stop (per paragraph), active reading time, read-through by source | Shipped | (issue not created yet) |
| Story Studio: a story's own page, who clapped (name, claps, when) and average attention | Shipped | [#40](https://github.com/yagnesh-pasam-07/penandpaper/issues/40) |
| Homepage: a slow, faint timeline of everything that changes behind the headline; /credits | Shipped | (issue not created yet) |
| Stories: readers sign in (Google) to clap and save; who loved it in Studio | Shipped | [#39](https://github.com/yagnesh-pasam-07/penandpaper/issues/39) |
| Stories: claps (tap up to 50, a sound, mobile-first) and Most loved ranking | Shipped | [#38](https://github.com/yagnesh-pasam-07/penandpaper/issues/38) |
| Stories: the person (name, place, photo, permission), series, sources box, Telugu ⇄ English | Shipped | [#37](https://github.com/yagnesh-pasam-07/penandpaper/issues/37) |
| Story Studio (reads, reach, shares by channel), Latest reads on the homepage, Instagram story card, a custom WhatsApp message and picture | Shipped | [#36](https://github.com/yagnesh-pasam-07/penandpaper/issues/36) |
| Stories: real human stories, history and art, written in Studio, read or heard at /stories; This week's story on the homepage | Shipped | [#35](https://github.com/yagnesh-pasam-07/penandpaper/issues/35) |
| Thought of the Day: one past thought a day, full screen, signature sound, recall time, notifications on every device | Shipped | [#34](https://github.com/yagnesh-pasam-07/penandpaper/issues/34) |
| Hold Space to talk in any text box (like Claude's CLI), a mic by the cursor, no header bar on the paper | Shipped | [#33](https://github.com/yagnesh-pasam-07/penandpaper/issues/33) |
| Canvas tools: Select, Text, Draw (with connectors), Eraser; hold Space to speak; "pen & paper, digitally" homepage | Shipped | [#31](https://github.com/yagnesh-pasam-07/penandpaper/issues/31) |
| Drops vs to-dos: a picture is a drop, with no tick or strike, and stays out of the review | Shipped | [#29](https://github.com/yagnesh-pasam-07/penandpaper/issues/29) |

---

## Decision log

### 2026-11-02 13:44 IST · product · Writing on the paper: five verbs, not thirty blocks (/ menu, @ people, text → to-do, remind me, ⌘Z)
Why: see "PRD: writing on the paper". Slack's canvas menu was studied item by item; only what a thinker does to words made it (decide, remember, structure, involve, take back), each reachable by typing, by `/`, or by a click. Decision tree: serves the loop (step 1: a written to-do is reviewed tonight and comes back; a typed reminder brings it back on time); no new screen or setting, `/` and `@` are menus that appear only while typing (step 2); a new kind `todo` (written text that is a to-do) changes what a thought is, so Tonight's paper, the resurface, the recall, strike and dates all accept it and the server enforces it; pictures stay drops (step 3); no migration, `kind` is plain text (step 4); undo protects words, and a mention never shares by itself (step 5).
Replaces: 2026-10-31 11:40 · Two kinds of thought (written text was always a drop; it can now be made a to-do by hand, which that entry left open)

### 2026-11-02 13:35 IST · design · Carrying a ring moves the ring, never the paper
Why: dragging a ring (or a shape or line) with Select also panned the whole canvas, so everything slid together and the move looked hectic. The page's pan listener is a native one that runs before React's, so the ring's own stopPropagation came too late; pressing a picked line, shape or corner handle now never pans (dragging bare paper still does). Notes carried inside a ring also lost their 200 ms easing while carried, so they stay locked to the ring instead of trailing it. Moving the paper and moving a thing are now separate gestures. Decision tree: a fix, no new control (steps 1-2), no data change (step 4).
Replaces: nothing

### 2026-11-02 13:31 IST · tech · Google sign-in is on; the reader sign-in sheet opens on the page, not inside the header
Why: Google keys are now set on Vercel (production) and `.env.local`, so "Continue with Google" shows on /login and on the clap sheet. The clap sheet was rendered inside the frosted stories header, and a backdrop-filter makes a fixed child position against that 65 px header instead of the window: on a computer the sheet centred on the header and its top, with the Google button, ran off the screen. It now renders on the page body and scrolls if a window is short. Google sends people back to penandpaper-app.vercel.app from every address (BETTER_AUTH_URL), so the other domains need no extra redirect URIs. Decision tree: a fix and a setting, no new control (steps 1-2); no data change (step 4).
Replaces: nothing

### 2026-11-02 11:37 IST · product · Built: select and resize, five inks, shapes, rings that hold things, dates and reminders, sharing, mentions, a smoother canvas
Why: the 10:45 plan, built, plus three asks from planning a real project on the paper: (1) a ring drawn round a person's column should carry everything in it, while each thing inside stays movable alone (#47); (2) a to-do needs a day and a reminder, like Slack's date chips (#48); (3) writing someone's name should bring them to the paper (#49). Decision tree: serves the loop (step 1: clearer planning, and a dated to-do coming back exactly when it matters is the loop's own promise); one Shape tool, colours shown only while they matter, the date behind a small clock on hover, Share as one button, a mention as a one-tap offer, not a setting (step 2); a date is only for to-dos and never for drops, enforced on the server; a shape or ring is ink and never reviewed (step 3); one add-only migration `0024_canvas_planning` (thoughts: size, color, due_at, due_has_time, reminded_at; strokes: color, shape, label; papers: public_token; new drop_shares), a ring's contents are worked out from positions, not stored (step 4); sharing can expose words, so off by default, view-only, server-checked per request, revocable at once, noindex, rate-limited, and a mention never shares without a tap (step 5, Security updated). Speed: pan and zoom draw once per frame, a dragged note updates once per frame, the live ink line is drawn straight to its path with no React work per point, and connector placement is cached per line. The tool keys are 1–5 (the bar used to show V/T/P/E, which never worked: letters open the writer).
Replaces: 2026-11-02 10:45 · The canvas grows up for project planning (its tickets #41–#45 are now built, not planned)

### 2026-11-02 10:45 IST · product · The canvas grows up for project planning: Select selects, five colours, two shapes, sharing, speed
Why: planning a project on the paper hit five walls. (1) With Select in hand, one click on written text opened the editor and its placeholder, so nothing could be selected, moved safely or made bigger; Select will now select (outline and handles), double-click or Enter edits, a corner drag resizes text (#41). (2) Every line was one colour, but in planning colour is meaning; five inks, each with a deep day value and a luminous night value, stored by name so they re-colour with the theme: Ink, Vermilion (risk), Cobalt (decision), Viridian (done), Saffron (idea), all ≥ 3:1 in both themes, measured (#42). (3) Boxes and circles group a phase or mark the one thing; a Shape tool with only rectangle and ellipse, hand-drawn, reshapeable, words inside, connectable (#43). (4) A paper couldn't leave the account; Share invites by email (read-only, sign-in with that email) or turns on a public read-only link with a random token, off by default (#44). (5) Desktop stutters because pan, zoom, note drag and drawing re-render React on every event; move them to direct DOM transforms in requestAnimationFrame and commit when the gesture ends, target 60 fps with 200 notes and 500 lines (#45). Further planning bets (frames, full undo, duplicate, status, export) are parked in #46. Decision tree: serves the loop, clearer thinking on the paper and the paper reaching the people it's for (step 1); one new tool and one Share button, colours appear only while drawing, nothing new to configure (step 2); a shape or coloured line is a drop, never a to-do, so Tonight's paper, the resurface and the email skip it as they skip lines today (step 3); add-only migrations: `drop_thoughts.size`, `drop_strokes.color`, `.shape`, `.label`, a `drop_shares` table and `drop_papers.public_token` (step 4); sharing could expose words, so off by default, `noindex`, checked on the server per request, revocable at once, invites rate-limited, noted under Security when shipped (step 5).
Replaces: 2026-10-31 13:30 · Canvas tools: Select, Text, Draw (connectors) and an eraser (its "no shapes palette, three tools" guardrail now allows one Shape tool with two shapes and five colours)

### 2026-11-02 09:25 IST · product · Studio Overview drops the Insights card
Why: the writer found the automatic advice ("Act: only 50% of new people wrote…", "Watch…", "Good…") noise next to the numbers themselves; the journey, realtime and charts already show the same facts. The Journey card takes the full width, its two funnels side by side. The insight rules stay in code (unused) in case they come back.
Replaces: the Insights card on /studio (2026-10 Studio entry).
Commit: (this commit)

### 2026-11-02 09:15 IST · design · Studio gets a frame like YouTube Studio: a left rail and full-width pages
Why: Studio pages sat in a narrow centred column (880–1200 px) with wide empty sides, and each page had its own header, so moving between the overview, the stories list and one story meant going back and forth. Now every Studio page shares one shell: a top bar (pen mark, Studio, View site, Lock), a fixed 240 px left rail with Overview, Stories and every live story listed by name (one click to any story's numbers), and the page using the full width beside it. On a phone the rail becomes a row of tabs under the top bar. A story's page leads with its four headline numbers, then on wide screens puts where readers stop, reading time and daily views on the left and who clapped and read-through by source on the right. The passcode screen keeps the plain bar. Decision tree: 1 serves the writer improving stories; 2 no new control (navigation that already existed, gathered in one place); 3 no; 4 no migration; 5 no.
Replaces: the per-page centred headers and max-width columns in /studio, /studio/stories and /studio/stories/[id]/reach.
Commit: (this commit)

### 2026-11-02 08:55 IST · design · About ends with LinkedIn, Instagram and X, each mark hand-drawn
Why: readers who like the stories want to follow the writer where he posts photos and thoughts. Three pill links under the signature (LinkedIn, instagram.com/yagnesh.pasam, x.com/YagneshPasam), with the marks drawn as pen strokes in the brand's style rather than pasted brand logos, ink by default and the red pen on hover; rel="me" so profiles can verify each other.
Replaces: the single plain "LinkedIn" text link on /about.
Commit: (this commit)

### 2026-11-02 08:40 IST · product · A story's own page in Studio: who clapped, and its average attention first
Why: the writer clicked a story and landed in the editor, and could see total claps but not who gave them or how many people that was. Now a published story in the Studio list opens its numbers page (Edit stays a link beside it; drafts still open the editor). The page leads, like YouTube Studio, with the four numbers that say whether a story held people: average attention (mean active reading time against the estimate), average % read (each tracked reader's furthest paragraph as a share of the story, averaged), finished it, and clapped (% of readers). **Who clapped** replaces the chips: every signed-in reader with their photo, name, email, when they last clapped and a bar of their claps out of 50, most first; above it people, claps each, how many gave all 50, and % of readers who clapped; claps from before sign-in was required are counted but unnamed. The list shows claps and people per story. Decision tree: 1 serves the writer improving stories; 2 no new control (a link target changes, one section on an existing page); 3 no; 4 no migration (reads story_claps and story_events as they are); 5 no.
Replaces: the "Who loved it" chips (2026-11-01 20:00) and the list row opening the editor for published stories.
Commit: (this commit)

### 2026-11-02 06:45 IST · product · Story Studio shows where readers stop, how long they really read, and which sources bring finishers
Why: claps and views say a story was opened, not whether it held attention. To improve a story the writer needs the paragraph where people leave. Each reader now sends one depth row per story that only moves forward: the deepest paragraph that came on screen (a third visible) and active reading seconds (tab visible, moved in the last 30 s, capped at 2 hours), at most every 15 s and once on leaving. The story's reach page shows a retention bar per paragraph in reading order with the biggest drop in red and a preview of that paragraph, typical and finishers' reading time against the estimate, the share reaching the middle, and read-through by source. Anonymous like every other count; readers never see it. Decision tree: 1 serves the writer improving stories; 2 no new control (one section on an existing page); 3 no; 4 an add-only migration (two nullable columns and a partial unique index on story_events); 5 no.
Replaces: nothing (only "opened" and "finished" were counted).
Commit: (this commit)

### 2026-11-02 06:20 IST · design · Light theme made premium: ivory paper, cards that lift, no grain by day
Why: light mode felt flat and beige next to the dark theme. Paper moves from beige (`#f6f3ec`) to bright warm ivory (`#faf8f4`), cards to `#fffdf9`, ink a touch deeper (`#1e1c19`, 16:1); every contrast pair still passes (mute 7.2, graphite 5.5, red 5.6, line-strong 3.5). Cards lift off the page with a new `--lift` shadow (a hairline and a long soft fall) and rise 2 px on hover; at night `--lift` is none and surfaces lift by colour as before. The paper grain is off by day (on light paper it read as dust). The homepage timeline is multiplied into the paper like faint print, each picture dissolving top and bottom, so there are no grey box edges. Dark theme unchanged. Rules in THEME.md (rules 4 and 7).
Replaces: 2026-11-01 23:00 "Paper by day, a lamp at night", for the light values and rule 4 only.
Commit: (this commit)

### 2026-11-02 06:00 IST · design · The homepage strip now includes the makers: da Vinci, Shakespeare, Nolan, Rajamouli, Keeravani, Naval Ravikant
Why: the brand admires the people behind the work (directors, writers, composers, thinkers) more than the faces on screen. Da Vinci and Shakespeare sit with history (after the Great Wall); Nolan, Rajamouli, Keeravani and Naval Ravikant after the first flight, as makers of the modern age. Same treatment (black and white, blurred, faint); portraits cropped to show the face. Credits on /credits. The founder will update this list.
Replaces: the 19-picture strip (2026-11-02 05:45), for its contents only.
Commit: (this commit)

### 2026-11-02 05:45 IST · design · Behind the homepage headline, a faint timeline of everything that changes
Why: the brand's belief is that a few things are constant (food, work, sleep, emotion) while everything else changes. Fire, cave painting, a hunter, palm leaf, a dhow, Krishna, Christ, Jama Masjid, the Great Wall, Darwin, the Somme, first flight, Mumbai and Dharavi, a full thali and an empty plate, a laptop, a phone and Andromeda drift slowly behind a still headline: the change moves, the belief stays. Kept as texture, not pictures (black and white, blurred, ~10% opacity, faded at the edges) so the headline reads first; real, freely licensed photographs and paintings, not drawings, because the brand is about real people; faith images placed together, never beside war. Tiles are 4–53 KB WebP (about 0.5 MB in all), decorative and hidden from screen readers; reduced motion stops the drift. Homepage only; story and Desk pages stay clean. Decision tree: 1 serves the homepage's job of saying what we believe; 2 adds no control (one footer link, Photo credits); 3–5 no.
Replaces: nothing (the headline sat on plain paper).
Commit: (this commit)

### 2026-11-02 00:30 IST · growth · Added auto OG share images + WhatsApp share button to stories — to improve reach from shares
Why: most readers arrive from a shared link (WhatsApp first, then Instagram and LinkedIn), and the preview card decides whether they tap. Every story gets its own 1200×630 card, made on the fly: warm ruled paper with a red margin line, *pen & paper* **stories** in our handwriting (Caveat), the title in Newsreader with a red marker stroke under it, the one-line hook, the reading time (and "Listen"), and the cover on the right. Telugu titles and hooks are shaped by sharp (Pango/HarfBuzz) with Noto Serif Telugu so conjuncts stack correctly (the card renderer, Satori, can't stack Telugu consonants); a short Telugu title shrinks to sit on one line. Fonts ship in the repo (no network at share time). JPEG of about 40–60 KB (WhatsApp skips previews much over 300 KB), cached a day. The homepage gets a brand card ("Your thoughts deserve to be written down."). Story pages already carry og:title, og:description, og:image and twitter:card summary_large_image, and the WhatsApp share button (in the byline and at the end). No new services.
Replaces: the first story card (2026-11-01, plain sans title, default fonts, no Telugu shaping) and the old homepage card ("Empty your head onto paper").

### 2026-11-01 23:00 IST · design · Paper by day, a lamp at night: one warm palette in two lights
Why: light mode felt off-brand and glaring (pure white cards on cream, a cool blue-black ink on warm paper), while dark mode felt right. Now both themes are the same warm hue family: warm off-white paper (`#f6f3ec`, cards `#fbf9f4`, never pure white) with warm near-black ink (`#22201c`) by day; warm charcoal (`#171614`) with soft chalk (`#e9e4da`, ~14:1, not glaring) at night. One red, deeper by day (`#b23a2c`) and softer at night (`#ec8a72`). New tokens: raised, sunken, line-strong (control borders ≥ 3:1), selection, highlight, brand-green. Every text pair measured (body ≥ 7:1, muted and small print ≥ 4.5:1, buttons ≥ 4.5:1); two old failures fixed (dark buttons were 4.4:1, control borders 1.3:1). Dark reading text gets a hair more letter spacing and less weight; pictures are dimmed a touch at night. The homepage now follows the system theme (it used to force light). Rules for future screens: THEME.md.
Replaces: the original Paper/Ink tokens (design canvas) for colour values only; names are unchanged.

### 2026-11-01 22:00 IST · product · One brand, two named products: Pen and Paper Stories and Pen and Paper Desk
Why: a story site with an app underneath felt like two unrelated things and cost trust. A parent with a belief and two named children feels intentional (like Google with Gmail and Maps). The homepage: "Pen and Paper" and the belief "Your thoughts deserve to be written down." (other people's, in our stories; your own, on your desk); two equal doors, *pen & paper* **stories** ("Real people, written down." → /stories) and *pen & paper* **desk** ("A quiet place for your own thoughts." → /desk); a short founder note with the founder's photo, in his words. Each product carries its name in its own header. The tool is "Desk": /tool redirects (308) to /desk. Desk is live, so its door says "Open your desk", not a waitlist.
Replaces: the story-first homepage (21:00) and the name "the tool".

### 2026-11-01 21:30 IST · design · The tool page says one thing, in four parts
Why: the writer couldn't tell what the tool was; nine sections below the gallery (two ways, pain points, highlight, fonts, everywhere, open source…) buried it. Now: "Your head is full. Put it down." + "One quiet paper for every thought you don't want to lose." + Start a paper; the scrolling screenshots; three steps (Drop it. See it. It comes back.); Try it, no account; one closing line and button, with "Also on Mac and in Chrome". Header: Stories, Sign in, theme. Unused sections deleted.
Replaces: the long tool landing page (2026-10-31 13:30 and earlier sections).

### 2026-11-01 21:00 IST · product · The homepage is a story publication; the tool moves to /tool
Why: Pen and Paper is becoming a brand about people ("Every person is a story. We write them down."), in the spirit of Humans of Bombay and The Marginalian; the thinking tool is a quiet room at the back, not the front door. The homepage: the tagline, the featured story (most loved this month, else newest) with its pull quote, cover, who and where, Read and Listen; "More stories" as a magazine grid (a story without a picture becomes a quote card); "Writers are witnesses."; a small tool section (A quiet place for your thoughts, a paper mock, Start a paper); a one-line footer. Signed-in people still land on their paper. The old landing page lives on at /tool. A short /about. Header: Stories, Tool, About.
Not done from the brief, on purpose: no "Coming soon" waitlist (the tool is live), no "free notebook" promise (not decided), no placeholder stories on the live site, no Instagram/WhatsApp links (no handles yet).
Replaces: the tool-first homepage (2026-10-31 13:30 "The story: first on paper, now pen & paper, digitally").

### 2026-11-01 20:00 IST · product · A clap is from a person: readers sign in (Google) to clap and save
Why: the writer wants to know who did something, and anonymous claps can be inflated by clearing a browser. Reading stays open (sign-in to read would kill the WhatsApp traffic); only actions that carry a person (clap, save) ask for it, at the moment of the action, and come straight back. Google first because almost every reader has it and it is one tap.
Decision tree: (1) the stories. (2) One sheet, shown only at the moment of an action; one header control. (3) Doesn't change what a thought is. (4) Add-only migration 0022: story_claps.user_id, story_saves. (5) Names are shown only to the writer in Studio; anonymous claps are merged into the account without double counting. (6) Checked against a real Postgres: signed-out clap 401, claim on sign-in keeps the total exact, cap holds, save and Saved, Studio list, 375 px sheet.
Replaces: anonymous claps from the 17:00 entry (existing anonymous claps stay counted).

### 2026-11-01 19:30 IST · product · Only "Death: The Ultimate Truth" is live
Why: the writer asked to keep only that story; the Sriramulu stories (English, Telugu, the cinematic and the complete versions) are unpublished, kept as drafts in Studio.
Replaces: nothing.

### 2026-11-01 18:45 IST · product · Stories: lists, "Written by", and readable addresses for Telugu titles
Why: the complete Sriramulu story needs a timeline, places and sources as real lists ("- " lines; one block in the editor, never HTML). The byline is "Written by <writer>": the person in the story is the witness, the writer wrote it (the writer's correction). A Telugu-only title gave "/stories/story-2"; a draft's address now follows its subtitle's first sentence when the title has no Latin letters ("the-words-are-ours").
Replaces: the "Witnessed and written by" byline from the 15:00 entry.

### 2026-11-01 17:00 IST · product · Claps rank the stories; the most-loved one is featured
Why: the writer wants readers to say how much a story moved them, and the best-loved stories to rise. A clap you can give many times (up to 50) says "a lot", which a single like can't; the cap keeps one reader from deciding the ranking. A sound and a buzz make it feel human on a phone.
Decision tree: (1) the stories, not the app. (2) One control for readers (the clap), placed where the thumb is on a phone; one ordering switch on /stories. (3) Doesn't change what a thought is. (4) Add-only migration 0021: story_claps, stories.claps. (5) Anonymous, rate-limited, bots and drafts refused. (6) Tests for the cap and short counts; checked against a real Postgres (30 → capped at 50 → no more; a second reader adds; total equals the sum; drafts 404; other sites ignored; ranking; homepage feature; 375 px, shared count, floating clap steps aside).
Replaces: "No likes, comments, streaks or view counters in v1" from the 11:30 Stories entry: claps are the one count readers see, beside the clap button and on cards; views and shares stay in Studio.

### 2026-11-01 16:30 IST · tech · A translation's address is the original's plus its language
Why: a Telugu-only title has no Latin letters, so its address came out as "/stories/story". Now "the-man-behind-the-words-te". A published address never changes (shared links keep working); unpublishing a translation lets it take the right one again.
Replaces: nothing.

### 2026-11-01 15:00 IST · product · Stories name the person, show their sources, come in series and in Telugu
Why: what makes Humans of Bombay real is one named person, in their own words, with their real photo and their consent; what makes history trustworthy is its sources, stated neutrally where dates are contested (1 November vs 2 June). Series bring readers back; Telugu reaches the people these stories are about. The belief behind it: writing is the original; the rest is summary. A story names who witnessed it and who wrote it.
Decision tree: (1) the stories, not the app's loop. (2) No new reader controls except the language switch, shown only when a translation exists; the writer's fields live in Publish. (3) Doesn't change what a thought is. (4) Add-only migration 0020 (person_name, person_place, person_photo_id, person_consent, series, sources, translation_of). (5) A person is shown only as the writer enters them; their photo is public only while a live story shows it (a translation can share the original's pictures). (6) Tests for sources and series; checked against a real Postgres (person card, byline, switch both ways, hreflang, sources, series page, shared cover, 375 px).
Replaces: nothing.

### 2026-11-01 13:45 IST · product · Story Studio: the writer sees reach; readers see no numbers
Why: to know which stories move people, and where they travel (WhatsApp first here), without turning the reading page into a scoreboard. Like YouTube Studio for the writer; calm and count-free for the reader.
Decision tree: (1) serves the stories, not the app's loop: public site and Studio only. (2) No new reader controls; one Instagram button beside WhatsApp; the writer gets one page per story and a line in the publish panel. (3) Doesn't change what a thought is. (4) Add-only migration 0019: story_events; stories.share_text, stories.share_media_id. (5) Privacy: no cookies, no IP, no names; a random browser id keyed with the app's secret; bots and drafts never counted; rate-limited. (6) Tests for sources, bots, the WhatsApp message, read-through and the daily chart; checked end to end against a real Postgres (dedupe, sources, channels, bots ignored, scheduled story refused, the Instagram card, the Studio page).
Replaces: nothing.

### 2026-11-01 13:45 IST · growth · Sharing is the growth engine: WhatsApp message and Instagram story card
Why: most first readers will arrive from a friend on WhatsApp, and Instagram Stories can't take a link from the web, so we give a card made for it. The default WhatsApp line is personal ("I read this and thought of you.") because a recommendation from a friend is read; a link alone is not.
Replaces: the plain WhatsApp link (title + URL) from the 11:30 Stories entry.

### 2026-11-01 13:00 IST · design · Stories read at Medium's measure
Why: the writer compared it with Medium and wanted the same comfortable width and gaps: a 680 px column with 24 px gutters, 20 px text at 1.6, and pictures at the column width (not wider).
Replaces: the 21 px / 1.75 text and wider pictures from the 11:30 Stories entry.

### 2026-11-01 12:30 IST · design · The stories header reads as one name: "pen & paper stories"
Why: "Stories" in a different, smaller serif beside the handwritten logo looked like two things that didn't fit. Now one handwritten name, the last word in the pen's red.
Replaces: the "pen & paper | Stories" header in the 11:30 entry.

### 2026-11-01 11:30 IST · product · Stories: a public, calm place for real human stories, history and art
Why: Pen & Paper is a brand, not only an app; stories build the audience (a link on WhatsApp is how most people here will meet it). Made for one-handed reading on a phone, listening while working, and feeling better after a bad day. Like Medium for the reader and the writer, without the noise: no claps, comments, counts or paywall.
Decision tree: (1) not the core loop of the app: so it lives outside it, on the public website, and never touches anyone's paper. (2) One new page set (/stories) and one homepage section; the writer's controls stay in Studio. (3) Doesn't change what a thought is. (4) Add-only migration 0018: stories, story_media, story_media_parts. (5) Drafts and scheduled stories are never public (files of an unpublished story 404); deleting a story asks first. (6) Tests for the role guard, scheduling, slugs, reading time, Markdown, the editor's round trip and the Medium importer; checked end to end against a real Postgres (publish, unpublish, schedule, upload, Range audio, share image, 375 px, dark).
Replaces: nothing.

### 2026-11-01 11:30 IST · tech · Story files in Postgres for v1, served by our own route
Why: no object storage is set up and audio can't be a data URL. Files are split into 1.5 MB parts (each request stays under Vercel's 4.5 MB limit), pictures resized on the fly to 480/960/1600 WebP and cached for a year, audio served with byte ranges. Moves to Vercel Blob with the paper's pictures.
Replaces: nothing.

### 2026-10-31 18:00 IST · design · Thought of the Day sits on solid paper over a blurred canvas

The card reused the `canvas-surface` class, which the canvas page clears to see-through, so the paper's thoughts showed through the card and it was unreadable. The card now paints its own solid sheet and the canvas behind is blurred, so the one thought is the only thing in view. Replaces the see-through card from 17:00.

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

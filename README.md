# Pen & Paper — Visual Team Task Planner

A simple, visual planner for small teams (2–20 people). A lead drops thoughts onto a paper, gives each a time, and drags them onto people. Each person gets their paper at 9:00 in their own time zone and strikes tasks out as they go.

**Drop → Estimate → Drag.**

- [Product Requirements Document](docs/PRD.md)
- Design: the "Pen and Paper — App Screens" canvas (the screen numbers below map to it)

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (time parsing, time zones, carry-over)
npm run build
```

Open **`/demo`** to load the story from the design (Yagnesh's team in Hyderabad, Berlin and Toronto) at either "Wednesday morning" or "Wednesday afternoon", and jump to any screen.

## Screens

| Design | Screen | Route |
| --- | --- | --- |
| 1.1 | Landing | `/` |
| 1.2 | Sign up | `/signup` |
| 2.1 | Projects (empty state / list) | `/projects` |
| 2.2 | New project | `/projects/new` |
| 2.3, 3.2 | Project created / Invites sent | `/projects/[id]` |
| 3.1 | Invite people | `/projects/[id]/invite` |
| 3.3 | Join from a phone | `/join/[code]` |
| 4.1 | Morning: start from yesterday | `/projects/[id]/paper` |
| 4.2, 4.3 | Drop thoughts, drag to people | `/projects/[id]/paper/plan` |
| 4.4 | Paper sent | `/projects/[id]/paper/sent` |
| 5.1, 5.2 | Live / Everyone's done | `/projects/[id]/live` |
| 6.1 | 9:00, the paper arrives | `/me/[id]/notify` |
| 6.2 | My projects | `/me` |
| 6.3 | Papers | `/me/[id]` |
| 6.4 | Today · tap to strike | `/me/[id]/today` |
| 6.5 | Ask for more time | `/me/[id]/today/more-time` |
| 6.6 | Paper done | `/me/[id]/done` |
| 6.7 | Day ends, carry over | `/me/[id]/carry` |

Lead screens are responsive from desktop down to phone width; member screens are phone-first and centered on desktop. Both themes, Paper (light) and Ink (dark), follow the OS setting and can be switched from the header.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- dnd-kit for drag and drop (mouse and touch), with tap-to-assign for phones and keyboard
- Zustand store saved to `localStorage`
- Vitest for unit tests

## Code map

```
src/app/            routes (one page per screen, each renders a screen component)
src/screens/        screen components: start, projects, paper, live, member, demo
src/components/     shared UI (header, avatar, modal, progress bar, icons, theme toggle)
src/lib/store.ts    all data and actions (create project, invite, drop, assign, send, strike, carry over…)
src/lib/demo.ts     the story's seed data
src/lib/time.ts     dates and time zones ("9:00 Berlin is 12:30 pm yours")
src/lib/estimate.ts "fix login 2h" -> title + estimate
```

## Not wired yet

This first build runs entirely in the browser, so it is a working prototype rather than a multi-user app:

- **Data** lives in `localStorage` per browser. A lead and a member only see each other's changes in the same browser (the `/demo` story uses this). Next: Postgres + Drizzle behind the same store actions.
- **Auth**: "Continue with Google" shows a note; email sign-up/join works without a password or verification. Next: Auth.js or Clerk.
- **Delivery**: invites, the 9:00 paper notification, "Help Dev" (opens email) and "Say thanks" are not sent anywhere yet. Next: email/push and the Slack integration from the PRD.
- The design's story is dated "Wednesday 22 Oct", but 22 Oct 2026 is a Thursday, so the demo uses Wednesday 21 Oct.

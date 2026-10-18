# Product Requirements Document: Pen & Paper — Visual Team Task Planner

| Field | Value |
|---|---|
| Product | Pen & Paper (working name) |
| Document owner | Yagnesh |
| Status | Draft v1.0 |
| Last updated | 2026-10-18 |
| Target release | MVP (v1) |

---

## 1. Summary

Pen & Paper is a lightweight, visual task-planning tool for small teams (2–20 people). It lets a team lead turn unstructured thoughts into estimated tasks and distribute them across team members based on each person's available hours, all on a single canvas.

**Core loop: Think → Estimate → Assign.**

The product is a visual whiteboard combined with a simple capacity-aware task allocator. It is not a full project management suite. Its single job is to make deciding *who does what today, and how much they can take* fast and obvious.

---

## 2. Problem Statement

Team leads of small teams plan the day's work in their heads, in chat messages, on sticky notes, or in heavyweight tools (Jira, Asana, ClickUp) that are built for tracking, not for *deciding*. This causes:

1. **Lost ideas.** Thoughts and requests are scattered across chat, notes, and memory; nothing captures them quickly.
2. **No effort visibility.** Work is assigned without an explicit estimate, so nobody knows how big a person's day actually is.
3. **Uneven load.** Some members are overloaded while others have spare capacity, and the lead only discovers this at end of day.
4. **Planning overhead.** Existing PM tools require forms, fields, sprints, and workflows. A 5-minute decision becomes a 30-minute admin task.

---

## 3. Goals and Non-Goals

### 3.1 Goals (MVP)

| # | Goal |
|---|---|
| G1 | A team lead can capture raw thoughts onto a canvas with near-zero friction (type + Enter). |
| G2 | Any thought can be converted into a task with a title, optional description, and an hour estimate. |
| G3 | Each team member has a visible, editable daily capacity (hours). |
| G4 | Tasks are assigned by drag-and-drop onto team members. |
| G5 | Allocated vs. available hours update instantly, with clear overload/underload signals. |
| G6 | The lead can review the full distribution and finalize the day's plan. |
| G7 | A full day for a 5-person team can be planned in under 5 minutes. |

### 3.2 Non-Goals (MVP)

- Task progress tracking, status workflows, or Kanban columns beyond "unassigned / assigned / done".
- Multi-day sprints, roadmaps, Gantt charts, or dependencies.
- Time tracking or timesheets.
- Native mobile apps (responsive web view-only is acceptable).
- Integrations (Jira, GitHub, Slack) — considered for later phases.
- AI auto-assignment (considered for later phases; see §11).

---

## 4. Target Users and Personas

### Primary persona — "Team Lead Tara"
- Engineering lead / startup founder / agency PM running a team of 3–15.
- Plans work every morning (or the evening before).
- Values speed over completeness; hates filling in forms.
- Success = "Everyone knows what they're doing today, and nobody is drowning."

### Secondary persona — "Team Member Ravi"
- Receives the day's tasks.
- Wants a clear list of what's assigned to him with estimates.
- MVP: read-only view of his own assignments via shared link / workspace access.

### Target segments
- Startup founders and engineering leads
- Software development team leads
- Small agencies and product teams
- Any 2–20 person team wanting lightweight planning

---

## 5. User Stories

| ID | As a… | I want to… | So that… | Priority |
|---|---|---|---|---|
| US-01 | Team lead | quickly type thoughts onto a canvas | I can empty my head without organizing | P0 |
| US-02 | Team lead | move, edit, and delete thought cards freely | the canvas reflects how I think | P0 |
| US-03 | Team lead | convert a thought into a task with an estimate | ideas become actionable | P0 |
| US-04 | Team lead | create a task directly (skipping the thought stage) | I don't waste steps on obvious work | P0 |
| US-05 | Team lead | add team members and set their available hours for the day | I know each person's capacity | P0 |
| US-06 | Team lead | drag a task onto a team member | assigning feels instant | P0 |
| US-07 | Team lead | see allocated / available hours per member update live | I avoid overloading anyone | P0 |
| US-08 | Team lead | see clearly who is overloaded or underutilized | I can rebalance at a glance | P0 |
| US-09 | Team lead | drag a task back to unassigned or to another member | I can rebalance easily | P0 |
| US-10 | Team lead | finalize the plan | the team knows the day's assignments are set | P0 |
| US-11 | Team member | see the tasks assigned to me with estimates | I know my day | P1 |
| US-12 | Team lead | undo / redo actions | I can experiment without fear | P1 |
| US-13 | Team lead | carry over unfinished tasks to the next day | nothing falls through the cracks | P1 |
| US-14 | Team lead | split a large task into smaller tasks | I can distribute big work across people | P2 |
| US-15 | Team lead | export / copy the final plan (Markdown / Slack-ready text) | I can share it where my team already talks | P1 |

---

## 6. Functional Requirements

### 6.1 Workspace & Canvas

| ID | Requirement |
|---|---|
| FR-1.1 | Each team has one workspace; each workspace contains one **plan per day** (date-scoped board). |
| FR-1.2 | The canvas is an infinite, pannable, zoomable 2D surface occupying the upper area of the screen. |
| FR-1.3 | The **team lane** is docked at the bottom of the screen and always visible regardless of canvas pan/zoom. |
| FR-1.4 | An **Unassigned Tasks** tray is visible on the canvas (or as a side panel) listing all tasks not yet assigned. |
| FR-1.5 | The current plan date is displayed and switchable (previous/next day, date picker). |

### 6.2 Brain Dump (Thought Cards)

| ID | Requirement |
|---|---|
| FR-2.1 | User can create a thought by double-clicking the canvas or pressing `N`, then typing and pressing `Enter`. |
| FR-2.2 | Pressing `Enter` saves and immediately opens a new thought input next to the previous one (rapid-fire capture). |
| FR-2.3 | Pasting multi-line text creates one thought card per line. |
| FR-2.4 | Thought cards are visually distinct from tasks (e.g., soft-colored bubbles, no estimate badge). |
| FR-2.5 | Thoughts can be moved, edited inline, color-tagged, and deleted. |
| FR-2.6 | Thoughts cannot be assigned to team members until converted to tasks. |

### 6.3 Tasks

| ID | Requirement |
|---|---|
| FR-3.1 | A thought converts to a task via a "Make task" action (button, context menu, or shortcut `T`). The thought text becomes the task title. |
| FR-3.2 | Task fields: **title** (required, ≤120 chars), **description** (optional, plain text / basic Markdown), **estimate in hours** (required to assign; 0.25h increments, range 0.25–24). |
| FR-3.3 | Estimate entry supports quick presets (0.5h, 1h, 2h, 3h, 5h, 8h) and free numeric input. Accepts formats like `2`, `1.5`, `90m`, `2h30m`. |
| FR-3.4 | Tasks without an estimate show a "needs estimate" indicator and cannot be dropped onto a member (drop is rejected with a tooltip prompting for an estimate). |
| FR-3.5 | Tasks can be created directly on the canvas without first being a thought. |
| FR-3.6 | Optional task fields (P1): priority (High / Normal / Low), tag/label. |
| FR-3.7 | A task can be converted back into a thought only while unassigned. |
| FR-3.8 | Task states: `unassigned`, `assigned`, `done` (done is togglable by lead or assignee; P1). |

### 6.4 Team & Capacity

| ID | Requirement |
|---|---|
| FR-4.1 | Lead can add, rename, reorder, and remove team members (max 20 per workspace in MVP). |
| FR-4.2 | Each member has a **default daily capacity** (hours) set once, and a **per-day override** editable on the member card. |
| FR-4.3 | Capacity range: 0–16 hours, 0.5h increments. 0 = unavailable (card shown greyed out, drops rejected). |
| FR-4.4 | Each member card shows: name/avatar, `allocated / available` hours (e.g., `7 / 8h`), a capacity bar, and their list of assigned tasks. |
| FR-4.5 | Removing a member who has assigned tasks returns those tasks to Unassigned (with confirmation). |

### 6.5 Drag-and-Drop Assignment

| ID | Requirement |
|---|---|
| FR-5.1 | Tasks can be dragged from the canvas / Unassigned tray onto any member card. |
| FR-5.2 | While dragging, each member card previews the resulting load (e.g., `8 → 11 / 8h`) and highlights in warning color if the drop would overload. |
| FR-5.3 | Dropping onto an overloaded result is **allowed** (lead's decision), but the member is flagged as overloaded. |
| FR-5.4 | Tasks can be dragged between members and back to Unassigned. |
| FR-5.5 | Multi-select (shift-click / lasso) and drag of multiple tasks at once (P1). |
| FR-5.6 | Keyboard alternative: select a task, press `A`, choose member from a picker (accessibility). |
| FR-5.7 | All allocation totals recalculate in < 100 ms after a drop. |

### 6.6 Capacity Calculation & Signals

Definitions per member for the selected day:

- `available = capacity override ?? default capacity`
- `allocated = Σ estimate of tasks assigned to the member`
- `remaining = available − allocated`
- `utilization = allocated / available`

| State | Rule | Visual |
|---|---|---|
| Unavailable | `available = 0` | Grey card |
| Underutilized | `utilization < 70%` | Blue / neutral bar, "Xh free" label |
| Balanced | `70% ≤ utilization ≤ 100%` | Green bar |
| Overloaded | `utilization > 100%` | Red bar, "+Xh over" label, warning icon |

Thresholds are workspace-configurable (P2). Color is never the only signal — labels and icons accompany every state.

### 6.7 Review & Finalize

| ID | Requirement |
|---|---|
| FR-7.1 | A **summary bar** shows team totals: total task hours, total team capacity, unassigned task count and hours, # overloaded, # underutilized. |
| FR-7.2 | A **Review** view lists each member with their tasks, totals, and status, plus the remaining unassigned tasks. |
| FR-7.3 | **Finalize plan** marks the day's plan as finalized: records timestamp and author, makes assignments visible to members, and shows a "Finalized" badge. |
| FR-7.4 | Before finalizing, the app warns (non-blocking) if there are unassigned tasks or overloaded members. |
| FR-7.5 | A finalized plan can still be edited; edits after finalization are marked "updated after finalize" (P1: change log). |
| FR-7.6 | Export the finalized plan as Markdown / plain text formatted for Slack or email (P1). |

### 6.8 Team Member View (P1)

| ID | Requirement |
|---|---|
| FR-8.1 | Members access the workspace via invite (email) and see a "My Day" list of their assigned tasks with estimates. |
| FR-8.2 | Members can mark tasks done; they cannot reassign or change estimates in MVP. |

### 6.9 Persistence & Collaboration

| ID | Requirement |
|---|---|
| FR-9.1 | All changes autosave (no Save button). |
| FR-9.2 | Undo/redo for canvas and assignment actions within the session (P1). |
| FR-9.3 | Unfinished tasks from a previous day can be carried over to the current day in one action (P1). |
| FR-9.4 | MVP assumes a single editor (the lead). Real-time multi-editor collaboration is a later phase. |

---

## 7. UX & Interaction Design

### 7.1 Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Pen & Paper  ◀ Tue, Oct 18 ▶        Summary: 21h tasks / 18h cap  │
│                                     3 unassigned · 1 overloaded    │
├────────────────────────────────────────────────────────────────────┤
│                                                     ┌────────────┐ │
│   ( idea: revamp onboarding )   ( bug in export? )  │ Unassigned │ │
│                                                     │ ▢ Login API│ │
│        ┌──────────────────┐                         │     3h     │ │
│        │ Fix dashboard    │   ( call w/ client )    │ ▢ Payment  │ │
│        │ bugs        2h   │                         │     5h     │ │
│        └──────────────────┘          CANVAS         └────────────┘ │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  TEAM LANE                                                         │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│ │ Ravi  7 / 8h │  │ Priya 6 / 6h │  │ Kiran 6 / 4h⚠│               │
│ │ ███████░     │  │ ████████     │  │ ██████████+2h│               │
│ │ • Login 3h   │  │ • Payment 5h │  │ • Docs 4h    │               │
│ │ • Bugs 2h    │  │ • PR rev 1h  │  │ • QA 2h      │               │
│ │ • Tests 2h   │  │              │  │              │               │
│ └──────────────┘  └──────────────┘  └──────────────┘               │
└────────────────────────────────────────────────────────────────────┘
```

### 7.2 Interaction principles

1. **Keyboard-first capture, mouse-first assignment.** Typing thoughts must never require the mouse; distributing work should feel physical.
2. **Instant feedback.** Every drag shows the consequence before the drop.
3. **No modals in the main flow.** Editing happens inline or in a lightweight side panel.
4. **Forgiving.** Undo everywhere; overloading is warned, not blocked.

### 7.3 Keyboard shortcuts (MVP)

| Key | Action |
|---|---|
| `N` / double-click | New thought |
| `Enter` | Save thought & start next |
| `T` | Convert selected thought to task |
| `E` | Edit estimate of selected task |
| `A` | Assign selected task (member picker) |
| `Del` / `Backspace` | Delete selected |
| `⌘/Ctrl + Z` / `⇧ + ⌘/Ctrl + Z` | Undo / Redo |
| `Space` + drag | Pan canvas |

---

## 8. Data Model (Conceptual)

```
Workspace
  id, name, owner_id, settings (thresholds, workday_hours)

User
  id, name, email, avatar_url

Member                       // a person on the team for this workspace
  id, workspace_id, user_id?, display_name, default_capacity_hours, order

DayPlan
  id, workspace_id, date, status (draft | finalized),
  finalized_at?, finalized_by?

MemberCapacity               // per-day override
  day_plan_id, member_id, capacity_hours

Thought
  id, day_plan_id, text, color, x, y, created_at

Task
  id, day_plan_id, title, description?, estimate_hours?,
  priority?, status (unassigned | assigned | done),
  assignee_member_id?, x?, y?, sort_order, source_thought_id?,
  carried_over_from_task_id?
```

Derived (not stored): `allocated`, `remaining`, `utilization`, member state.

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Canvas stays at 60 fps with 300 cards; allocation recalculation < 100 ms; initial load < 2 s on broadband. |
| Scale (MVP) | Up to 20 members and 300 tasks/thoughts per day plan. |
| Availability | 99.5% monthly uptime. |
| Data safety | Autosave with no data loss on refresh/close; offline edits queued and synced on reconnect (P1). |
| Security | Auth via email magic link or Google OAuth; workspace data isolated per tenant; HTTPS only. |
| Accessibility | WCAG 2.1 AA: keyboard path for every action (incl. assignment), non-color status signals, screen-reader labels. |
| Browsers | Latest 2 versions of Chrome, Edge, Firefox, Safari. Desktop-first; tablet usable; mobile read-only. |
| Privacy | No task content used for analytics; product analytics on events only. |

---

## 10. Success Metrics

| Metric | Target (3 months post-launch) |
|---|---|
| Time to plan a day (5-person team) | Median < 5 minutes |
| Activation: workspace creates ≥ 1 finalized plan within 24 h of signup | ≥ 50% |
| Weekly retention: leads finalizing plans ≥ 3 days/week | ≥ 40% of active workspaces |
| Thought → task conversion rate | ≥ 60% |
| Plans finalized with zero overloaded members | ≥ 70% |
| Qualitative: "planning feels effortless" (in-app survey, 1–5) | ≥ 4.2 avg |

---

## 11. Release Plan

### Phase 1 — MVP
Canvas, thoughts, tasks with estimates, team lane with capacity, drag-and-drop assignment, live capacity signals, summary bar, finalize, autosave, single-editor auth.

### Phase 2 — Team
Member "My Day" view, mark done, carry-over, undo/redo, Markdown/Slack export, multi-select drag, post-finalize change log.

### Phase 3 — Smart & Connected
- **Suggest assignment**: one-click auto-balance proposal the lead can accept/adjust.
- AI brain-dump parsing: paste a messy paragraph → suggested tasks with estimates.
- Estimate-accuracy feedback (estimated vs. actual).
- Integrations: Slack (post plan), GitHub/Jira (import issues as thoughts), Google Calendar (auto-derive capacity from meetings).
- Real-time multi-editor collaboration.

---

## 12. Assumptions

1. The team lead is the only person planning; members consume the plan.
2. Hours are a good-enough unit of effort for small teams (no story points).
3. Planning is primarily daily; multi-day tasks are split or re-assigned daily.
4. Teams are small enough (≤ 20) that a single horizontal team lane fits on screen (scrolls horizontally beyond ~8 members).

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Leads skip estimating, breaking the capacity model | Make estimating one keystroke (presets); block assignment without an estimate. |
| Canvas becomes cluttered | Auto-tidy action, collapse converted thoughts, Unassigned tray as the source of truth. |
| Product drifts into a full PM tool | Hold to non-goals; every feature must shorten Think → Estimate → Assign. |
| Low member adoption | Export to Slack/email so members don't need to log in for value. |
| Estimates are consistently wrong | Phase 3 estimate-accuracy feedback. |

## 14. Open Questions

1. Should capacity default to a fixed workday (8h) or require explicit setup on first use?
2. Do we need half-day/partial availability presets (e.g., "AM only")?
3. Should finalized plans notify members (email/Slack) automatically in MVP?
4. Pricing model: free for ≤ 5 members, paid per workspace above?
5. Is a weekly view (capacity across days) needed sooner than Phase 3?

## 15. Glossary

| Term | Meaning |
|---|---|
| Thought | An unstructured idea card on the canvas; not assignable. |
| Task | An actionable item with a title and hour estimate; assignable. |
| Capacity | Hours a member is available on a given day. |
| Allocated | Sum of estimates of tasks assigned to a member. |
| Day plan | The board of thoughts, tasks, and assignments for one date. |
| Finalize | Marking a day plan as decided and visible to the team. |

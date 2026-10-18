"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { bubbleStyle } from "@/components/canvas/bubble";
import { Hydrated } from "@/components/hydration";
import { ArrowIcon, CloseIcon, PaperPlaneIcon, PenIcon } from "@/components/icons";
import { Avatar, Breadcrumb, LeadHeader, NotFound, ProgressBar, btn } from "@/components/ui";
import { formatEstLong, formatHours, formatNum } from "@/lib/estimate";
import { carryOver, onLeave, paperFor, previousPaper } from "@/lib/mutations";
import { useStore } from "@/lib/store";
import { hourIn, loadOf, looseThoughts, presentMembers, recipients, sumEst, tasksOf } from "@/lib/selectors";
import { clock, sameClock, shortDate, weekday, zonedTime } from "@/lib/time";
import type { Member, Project, Task } from "@/lib/types";
import { useProject } from "@/lib/use-project";

/** "Berlin · starts 9:00, 12:30 pm yours" */
export function startsLine(member: Member, project: Project, date: string): string {
  if (sameClock(member.tz, project.leadTz)) return `${member.city} · starts 9:00`;
  return `${member.city} · starts 9:00, ${clock(zonedTime(date, 9, 0, member.tz), project.leadTz)} yours`;
}

function useClock(tz: string): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return clock(now, tz);
}

function Guard({ children }: { children: (project: Project) => React.ReactNode }) {
  const lead = useStore((s) => s.lead);
  const project = useProject();
  if (!lead) return <NotFound what="Sign in to plan your team's day." href="/signup" cta="Sign in" />;
  if (!project?.isOwner) return <NotFound what="This project doesn't exist, or you don't lead it." href="/projects" cta="All projects" />;
  return <>{children(project)}</>;
}

/* ---------- 4.1 Morning: start from yesterday ---------- */

export function PaperStartScreen() {
  return (
    <Hydrated>
      <Guard>{(p) => <PaperStart project={p} />}</Guard>
    </Hydrated>
  );
}

function PaperStart({ project }: { project: Project }) {
  const router = useRouter();
  const lead = useStore((s) => s.lead)!;
  const startPaper = useStore((s) => s.startPaper);
  const setLeave = useStore((s) => s.setLeave);
  const now = useClock(project.leadTz);

  const date = project.currentDate;
  const day = weekday(date);
  const paper = paperFor(project, date);
  const carried = paper ? paper.tasks.filter((t) => t.carriedFrom) : carryOver(project, date).filter((t) => t.carriedFrom);
  const prev = previousPaper(project, date);
  const present = presentMembers(project, date);
  const capacity = present.reduce((s, m) => s + m.hours, 0);
  const placed = sumEst(carried.filter((t) => present.some((m) => m.id === t.assigneeId)));
  const hour = hourIn(project.leadTz);
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const memberName = (id: string | null) => project.members.find((m) => m.id === id)?.name ?? "Unassigned";

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LeadHeader
        left={<Breadcrumb href={`/projects/${project.id}`} label={project.name} />}
        right={
          <span className="hidden text-sm text-mute sm:inline">
            {now} · {project.leadCity}
          </span>
        }
      />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-8 px-4 pt-6 pb-12 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <span className="font-hand text-[40px] leading-none font-bold sm:text-5xl">
            {hello}, {lead.name}.
          </span>
          <span className="text-lg text-mute">
            {carried.length ? `${day}'s paper already has a head start.` : `${day}'s paper is a fresh sheet.`}
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5">
          <section aria-label={prev ? `Carried from ${weekday(prev.date)}` : "Carried over"} className="flex flex-col rounded-[20px] border border-line bg-sheet py-2">
            <span className="flex items-baseline justify-between px-[22px] pt-3.5 pb-2.5">
              <span className="text-base font-semibold">{prev ? `Carried from ${weekday(prev.date)}` : "Carried over"}</span>
              <span className="font-mono text-[13px] text-mute">
                {carried.length} {carried.length === 1 ? "task" : "tasks"} · {formatHours(sumEst(carried))}
              </span>
            </span>
            {carried.map((t) => (
              <div key={t.id} className="flex items-center gap-3.5 border-t border-line px-[22px] py-3.5">
                <span className="size-[22px] shrink-0 rounded-full border-2 border-dashed border-amber" aria-hidden="true" />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-base">{t.title}</span>
                  <span className="text-[13px] text-mute">
                    {memberName(t.assigneeId)}
                    {t.carryNote ? ` · said "${t.carryNote}"` : ""}
                  </span>
                </span>
                <span className="font-mono text-[13px] text-mute">{t.est !== null ? formatHours(t.est) : "–"}</span>
              </div>
            ))}
            <span className="border-t border-line px-[22px] pt-3 pb-2.5 text-[13px] text-mute">
              {carried.length
                ? "They stay with the same person. Drag one to move it."
                : prev
                  ? `Everything on ${weekday(prev.date)}'s paper was struck.`
                  : "This is your first paper. Nothing to carry."}
            </span>
          </section>

          <section aria-label="Who's in today" className="flex flex-col rounded-[20px] border border-line bg-sheet py-2">
            <span className="flex items-baseline justify-between px-[22px] pt-3.5 pb-2.5">
              <span className="text-base font-semibold">Who&apos;s in today</span>
              <span className="font-mono text-[13px] text-mute">
                {present.length} of {project.members.length} · {formatHours(capacity)}
              </span>
            </span>
            {project.members.length === 0 && (
              <Link href={`/projects/${project.id}/invite`} className="border-t border-line px-[22px] py-3.5 text-[15px] font-semibold">
                Invite your team first
              </Link>
            )}
            {project.members.map((m) => {
              const away = onLeave(m, date);
              return (
                <div key={m.id} className={`flex items-center gap-3.5 border-t border-line px-[22px] py-3 ${away ? "text-mute" : ""}`}>
                  {away ? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-line text-[13px] font-semibold">
                      {m.name.charAt(0)}
                    </span>
                  ) : (
                    <Avatar name={m.name} tint={m.tint} size={32} />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base">{m.name}</span>
                    <span className={`text-[13px] ${away ? "" : "text-mute"}`}>
                      {away ? "On leave today" : m.status === "invited" ? `Invite pending · ${m.city}` : startsLine(m, project, date)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLeave(project.id, m.id, date, !away)}
                    className="rounded-lg px-2 py-1.5 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink"
                  >
                    {away ? "Back in" : "On leave"}
                  </button>
                  <span className="w-9 text-right font-mono text-[13px] text-mute">{away ? "0h" : formatHours(m.hours)}</span>
                </div>
              );
            })}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <span className="text-base text-mute">
            <span className="font-semibold text-ink">{formatHours(Math.max(0, capacity - placed))} free</span> across {present.length}{" "}
            {present.length === 1 ? "person" : "people"}. {formatHours(placed)} already placed.
          </span>
          {paper?.status === "sent" ? (
            <Link href={`/projects/${project.id}/live`} className={btn.primary}>
              {day}&apos;s paper is out · Watch the day
              <ArrowIcon />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                startPaper(project.id, date);
                router.push(`/projects/${project.id}/paper/plan`);
              }}
              className={btn.primary}
            >
              {paper ? `Continue ${day}'s paper` : `Start ${day}'s paper`}
              <ArrowIcon />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- 4.2 Drop thoughts / 4.3 Drag to people ---------- */

const PRESETS = [0.5, 1, 1.5, 2, 3, 4, 5, 6];

function BubbleFace({ task }: { task: Task }) {
  return (
    <>
      <span className="font-hand text-[22px] leading-tight font-semibold sm:text-[26px]">{task.title}</span>
      <span className={`font-mono text-xs ${task.est === null ? "text-red-text" : "text-mute"}`}>
        {task.est === null ? "+ time" : formatEstLong(task.est)}
      </span>
    </>
  );
}

function Bubble({ task, selected, onSelect }: { task: Task; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${task.title}, ${task.est === null ? "no time yet" : formatEstLong(task.est)}. Drag to a person, or select then pick a person.`}
      style={{
        ...bubbleStyle(task.shape),
        opacity: isDragging ? 0.35 : 1,
        outline: selected ? "2px solid var(--red-text)" : undefined,
        outlineOffset: 4,
      }}
      className="flex max-w-[260px] cursor-grab touch-manipulation flex-col items-center gap-1.5 px-7 py-6 text-center active:cursor-grabbing"
    >
      <BubbleFace task={task} />
    </button>
  );
}

function BucketTask({ task, onUnassign }: { task: Task; onUnassign: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <span className={`group flex items-center justify-between gap-2 text-[15px] ${isDragging ? "opacity-35" : ""}`}>
      <span ref={setNodeRef} {...listeners} {...attributes} className="min-w-0 flex-1 cursor-grab touch-manipulation">
        {task.title}
        {task.carriedFrom && <span className="text-xs text-amber"> · from {shortDate(task.carriedFrom).slice(0, 3)}</span>}
      </span>
      <span className="font-mono text-xs text-mute">{task.est !== null ? formatHours(task.est) : "–"}</span>
      <button
        type="button"
        onClick={onUnassign}
        aria-label={`Take ${task.title} back to the paper`}
        className="flex size-6 items-center justify-center rounded-full text-mute opacity-60 group-hover:opacity-100 hover:bg-soft"
      >
        <CloseIcon size={11} />
      </button>
    </span>
  );
}

function Bucket({
  member,
  tasks,
  dragging,
  selected,
  onPick,
  onUnassign,
}: {
  member: Member;
  tasks: Task[];
  dragging: Task | null;
  selected: Task | null;
  onPick: () => void;
  onUnassign: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `member:${member.id}` });
  const planned = sumEst(tasks);
  const load = loadOf(planned, member.hours);
  const incoming = dragging && dragging.assigneeId !== member.id ? (dragging.est ?? 0) : 0;
  const after = member.hours - planned - incoming;
  const hot = isOver && dragging && dragging.assigneeId !== member.id;
  const empty = tasks.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[150px] flex-col gap-3 rounded-[18px] p-4 transition-colors sm:p-[18px] ${
        hot ? "border-2 border-dashed border-red-text bg-red-soft" : empty ? "border-[1.5px] border-dashed border-line" : "border border-line bg-sheet"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Avatar name={member.name} tint={member.tint} />
        <span className="flex flex-1 flex-col">
          <span className="font-semibold">{member.name}</span>
          <span className="text-xs text-mute">{member.city}</span>
        </span>
        <span className={`font-mono text-xs ${load === "over" ? "text-red-text" : load === "near" ? "text-amber" : "text-mute"}`}>
          {formatNum(planned)} / {formatHours(member.hours)}
        </span>
      </span>
      {!empty && <ProgressBar pct={(planned / member.hours) * 100} tone={load === "over" ? "red" : load === "near" ? "amber" : "ink"} />}
      {tasks.map((t) => (
        <BucketTask key={t.id} task={t} onUnassign={() => onUnassign(t.id)} />
      ))}
      {hot ? (
        <span className="font-hand text-xl text-red-text">
          {dragging?.est === null ? "give it a time first" : after >= 0 ? `let go · fits, ${formatHours(after)} left` : `let go · ${formatHours(-after)} over`}
        </span>
      ) : selected && selected.assigneeId !== member.id ? (
        <button type="button" onClick={onPick} className="mt-auto h-10 rounded-[10px] border border-ink text-sm font-semibold hover:bg-soft">
          Give to {member.name}
        </button>
      ) : (
        empty && <span className="m-auto font-hand text-xl text-mute">drag a thought here</span>
      )}
    </div>
  );
}

function ThoughtsArea({ children, dense }: { children: React.ReactNode; dense: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "thoughts" });
  return (
    <section
      ref={setNodeRef}
      aria-label="Thoughts"
      className={`dot-grid flex flex-wrap content-center items-center justify-center gap-x-9 gap-y-7 rounded-[22px] p-4 sm:p-6 ${dense ? "min-h-[220px]" : "min-h-[300px] flex-1"} ${isOver ? "outline-2 outline-offset-2 outline-red-text outline-dashed" : ""}`}
    >
      {children}
    </section>
  );
}

export function PaperPlanScreen() {
  return (
    <Hydrated>
      <Guard>{(p) => <PaperPlan project={p} />}</Guard>
    </Hydrated>
  );
}

function PaperPlan({ project }: { project: Project }) {
  const router = useRouter();
  const { startPaper, dropThought, setEstimate, assign, removeTask, sendPaper } = useStore();
  const date = project.currentDate;
  const paper = paperFor(project, date);
  const [text, setText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );
  // Keyboard path: Enter selects a thought, then "Give to …" on a person.

  if (!paper) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
        <span className="font-hand text-4xl font-bold">{weekday(date)}&apos;s paper isn&apos;t started.</span>
        <button type="button" className={btn.primary} onClick={() => startPaper(project.id, date)}>
          Start {weekday(date)}&apos;s paper
        </button>
      </div>
    );
  }

  const people = presentMembers(project, date);
  const loose = looseThoughts(paper);
  const assigned = paper.tasks.filter((t) => t.assigneeId);
  const newAssigned = assigned.filter((t) => !t.carriedFrom);
  const canSend = paper.status === "draft" && assigned.length > 0 && (newAssigned.length > 0 || loose.length === 0);
  const byId = (id: string | null) => paper.tasks.find((t) => t.id === id) ?? null;
  const active = byId(activeId);
  const selected = byId(selectedId);

  const give = (task: Task, memberId: string | null) => {
    if (memberId && task.est === null) {
      setNotice(`Give "${task.title}" a time first.`);
      setSelectedId(task.id);
      return;
    }
    setNotice("");
    assign(project.id, date, task.id, memberId);
    setSelectedId(null);
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setNotice("");
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const task = byId(String(e.active.id));
    const over = e.over ? String(e.over.id) : null;
    if (!task || !over) return;
    if (over === "thoughts") give(task, null);
    else if (over.startsWith("member:")) give(task, over.slice("member:".length));
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LeadHeader
        wide
        left={<Breadcrumb href={`/projects/${project.id}/paper`} label={project.name} title={shortDate(date)} />}
        right={
          paper.status === "sent" ? (
            <Link href={`/projects/${project.id}/live`} className={btn.primarySm}>
              Sent · Watch the day
            </Link>
          ) : canSend ? (
            <button
              type="button"
              onClick={() => {
                sendPaper(project.id, date);
                router.push(`/projects/${project.id}/paper/sent`);
              }}
              className={btn.primarySm}
            >
              Send to team
              <ArrowIcon />
            </button>
          ) : (
            <span className={btn.disabled} aria-disabled="true" title="Hand out at least one new thought first">
              Send to team
            </span>
          )
        }
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-6 px-4 pt-4 pb-10 sm:px-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              dropThought(project.id, date, text);
              setText("");
            }}
          >
            <label className="flex h-[60px] items-center gap-3 rounded-2xl border-[1.5px] border-ink bg-sheet px-5 text-red-text">
              <PenIcon size={20} />
              <input
                aria-label="Drop a thought"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="fix calendar overlap 2h"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-mute focus-visible:outline-none"
              />
              <span className="hidden text-[13px] text-mute sm:inline">Enter to drop</span>
            </label>
          </form>

          <ThoughtsArea dense={assigned.length > 0}>
            {loose.map((t) => (
              <Bubble key={t.id} task={t} selected={selectedId === t.id} onSelect={() => setSelectedId(selectedId === t.id ? null : t.id)} />
            ))}
            {loose.length === 0 ? (
              <span className="font-hand text-[22px] text-mute">
                {paper.tasks.length ? "every thought has a home" : "type above, press Enter, thoughts land here"}
              </span>
            ) : (
              assigned.length > 0 && (
                <span className="font-hand text-[22px] text-mute">
                  {loose.length} {loose.length === 1 ? "thought" : "thoughts"} left
                </span>
              )
            )}
          </ThoughtsArea>

          {(selected || notice) && (
            <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-sheet px-4 py-3">
              {notice && <span className="w-full text-sm font-medium text-red-text">{notice}</span>}
              {selected && (
                <>
                  <span className="mr-1 text-sm font-semibold">{selected.title}</span>
                  <span className="text-sm text-mute">time:</span>
                  {PRESETS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={selected.est === h}
                      onClick={() => {
                        setEstimate(project.id, date, selected.id, h);
                        setNotice("");
                      }}
                      className={`h-9 rounded-[10px] px-2.5 font-mono text-[13px] ${selected.est === h ? "bg-ink text-bg" : "border border-line hover:bg-soft"}`}
                    >
                      {formatEstLong(h)}
                    </button>
                  ))}
                  <span className="flex-1" />
                  <span className="text-sm text-mute max-sm:hidden">then pick a person below</span>
                  <button
                    type="button"
                    onClick={() => {
                      removeTask(project.id, date, selected.id);
                      setSelectedId(null);
                      setNotice("");
                    }}
                    className="h-9 rounded-[10px] px-3 text-sm font-medium text-red-text hover:bg-red-soft"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          )}

          <section aria-label="People" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-3.5">
            {people.map((m) => (
              <Bucket
                key={m.id}
                member={m}
                tasks={tasksOf(paper, m.id)}
                dragging={active}
                selected={selected}
                onPick={() => selected && give(selected, m.id)}
                onUnassign={(id) => assign(project.id, date, id, null)}
              />
            ))}
            {people.length === 0 && (
              <Link href={`/projects/${project.id}/invite`} className="rounded-[18px] border-[1.5px] border-dashed border-line p-6 text-center font-semibold">
                Invite your team to hand out work
              </Link>
            )}
          </section>
        </main>

        <DragOverlay dropAnimation={null}>
          {active && (
            <div style={bubbleStyle(active.shape, true)} className="flex max-w-[260px] cursor-grabbing flex-col items-center gap-1.5 px-7 py-6 text-center">
              <BubbleFace task={active} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ---------- 4.4 Paper sent ---------- */

export function PaperSentScreen() {
  return (
    <Hydrated>
      <Guard>{(p) => <PaperSent project={p} />}</Guard>
    </Hydrated>
  );
}

function PaperSent({ project }: { project: Project }) {
  const date = project.currentDate;
  const paper = paperFor(project, date);
  if (!paper || paper.status !== "sent") {
    return <NotFound what={`${weekday(date)}'s paper hasn't been sent yet.`} href={`/projects/${project.id}/paper/plan`} cta="Back to the paper" />;
  }
  const people = recipients(project, paper);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-7 text-center">
        <PaperPlaneIcon />
        <div className="flex flex-col gap-2">
          <span className="font-hand text-5xl leading-none font-bold sm:text-[52px]">
            Sent to {people.length} {people.length === 1 ? "person" : "people"}.
          </span>
          <span className="text-[17px] text-mute">Each person gets it at 9:00 in their own time zone.</span>
        </div>
        <div className="flex w-full flex-col rounded-[18px] border border-line bg-sheet text-left">
          {people.map((m, i) => {
            const mine = tasksOf(paper, m.id);
            const other = !sameClock(m.tz, project.leadTz);
            return (
              <span key={m.id} className={`flex items-center gap-3 px-[18px] py-3.5 ${i < people.length - 1 ? "border-b border-line" : ""}`}>
                <Avatar name={m.name} tint={m.tint} />
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{m.name}</span>
                  {other && (
                    <span className="text-xs text-mute">
                      {m.city} · arrives {clock(zonedTime(date, 9, 0, m.tz), project.leadTz)} yours
                    </span>
                  )}
                </span>
                <span className="font-mono text-[13px] text-mute">
                  {mine.length} {mine.length === 1 ? "task" : "tasks"} · {formatHours(sumEst(mine))}
                </span>
              </span>
            );
          })}
        </div>
        <Link href={`/projects/${project.id}/live`} className={`${btn.primary} px-7`}>
          Watch the day
        </Link>
      </div>
    </div>
  );
}

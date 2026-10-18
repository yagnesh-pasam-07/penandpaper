"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hydrated } from "@/components/hydration";
import { BigCheck } from "@/components/icons";
import { Avatar, Breadcrumb, LeadHeader, NotFound, ProgressBar, btn } from "@/components/ui";
import { formatHours } from "@/lib/estimate";
import { paperFor, useStore } from "@/lib/store";
import { finishedAt, recipients, sumEst, tasksOf } from "@/lib/selectors";
import { clock, nextWorkday, sameClock, shortDate, weekday } from "@/lib/time";
import type { Member, Paper, Project, Task } from "@/lib/types";
import { useProject } from "@/lib/use-project";
import { startsLine } from "./paper";

export function LiveScreen() {
  return (
    <Hydrated>
      <LiveGuard />
    </Hydrated>
  );
}

function LiveGuard() {
  const lead = useStore((s) => s.lead);
  const project = useProject();
  if (!lead) return <NotFound what="Sign up to plan your team's day." href="/signup" cta="Sign up" />;
  if (!project) return <NotFound what="This project doesn't exist in this browser." href="/projects" cta="All projects" />;
  const paper = paperFor(project, project.currentDate);
  if (!paper || paper.status !== "sent") {
    return (
      <NotFound
        what={`${weekday(project.currentDate)}'s paper hasn't gone out yet.`}
        href={`/projects/${project.id}/paper`}
        cta={`Plan ${weekday(project.currentDate)}'s paper`}
      />
    );
  }
  const allDone = paper.tasks.filter((t) => t.assigneeId).every((t) => t.done);
  return allDone ? <LiveDone project={project} paper={paper} /> : <Live project={project} paper={paper} />;
}

/* ---------- 5.1 Live: only what needs you ---------- */

type Row =
  | { kind: "blocked"; member: Member; task: Task; tasks: Task[] }
  | { kind: "request"; member: Member; task: Task }
  | { kind: "member"; member: Member; tasks: Task[]; pct: number };

function Live({ project, paper }: { project: Project; paper: Paper }) {
  const { answerRequest, setBlocked } = useStore();
  const date = paper.date;
  const handedOut = paper.tasks.filter((t) => t.assigneeId);
  const doneCount = handedOut.filter((t) => t.done).length;
  const doneHours = sumEst(handedOut.filter((t) => t.done));
  const totalHours = sumEst(handedOut);

  const needs: Row[] = [];
  const others: Row[] = [];
  for (const m of recipients(project, paper)) {
    const tasks = tasksOf(paper, m.id);
    const blocked = tasks.find((t) => t.blocked && !t.done);
    if (blocked) needs.push({ kind: "blocked", member: m, task: blocked, tasks });
    for (const t of tasks) if (t.request?.state === "pending" && !t.done) needs.push({ kind: "request", member: m, task: t });
    if (!blocked) {
      const planned = sumEst(tasks);
      others.push({ kind: "member", member: m, tasks, pct: planned ? (sumEst(tasks.filter((t) => t.done)) / planned) * 100 : 0 });
    }
  }
  // People who need you sit on top; finished people sink to the bottom.
  others.sort((a, b) => (a.kind === "member" && b.kind === "member" ? a.pct - b.pct : 0));
  const rows = [...needs, ...others];
  const needCount = needs.length;

  const subtitle = (m: Member, tasks: Task[]) => {
    const closed = paper.closed[m.id];
    if (tasks.every((t) => t.done)) {
      const at = finishedAt(paper, m.id);
      return { text: `Paper done${at ? ` at ${clock(at, project.leadTz)}` : ""}`, tone: "text-green font-medium" };
    }
    if (closed) return { text: `Closed the day${closed.reason ? ` · ${closed.reason.toLowerCase()}` : ""}`, tone: "text-amber font-medium" };
    if (!tasks.some((t) => t.done)) {
      const line = startsLine(m, project, date).replace(`${m.city} · starts`, "Starts");
      return { text: sameClock(m.tz, project.leadTz) ? line : line.replace("Starts 9:00", `Starts 9:00 ${m.city}`), tone: "text-mute" };
    }
    const next = tasks.find((t) => !t.done);
    return { text: next ? `On ${next.title.toLowerCase()}` : "", tone: "text-mute" };
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LeadHeader
        left={<Breadcrumb href={`/projects/${project.id}`} label={project.name} title={shortDate(date)} />}
        right={
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-green">
            <span className="size-2 rounded-full bg-green shadow-[0_0_0_4px_var(--green-soft)]" />
            Live
          </span>
        }
      />
      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-7 px-4 pt-6 pb-12 sm:px-8">
        <div className="flex flex-col gap-3.5">
          <span className="text-2xl font-semibold tracking-[-0.02em] sm:text-[30px]">
            {doneCount} of {handedOut.length} tasks done{" "}
            <span className="font-normal text-mute">
              · {needCount === 0 ? "nothing needs you" : `${needCount} ${needCount === 1 ? "thing needs" : "things need"} you`}
            </span>
          </span>
          <ProgressBar pct={totalHours ? (doneHours / totalHours) * 100 : 0} height={10} />
        </div>

        <ul className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-sheet">
          {rows.map((row, i) => {
            const last = i === rows.length - 1;
            const rowClass = `flex flex-wrap items-center gap-4 px-[22px] py-5 ${last ? "" : "border-b border-line"}`;
            if (row.kind === "blocked") {
              const done = row.tasks.filter((t) => t.done).length;
              return (
                <li key={`b-${row.member.id}`} className={`${rowClass} bg-red-soft`}>
                  <Avatar name={row.member.name} tint={row.member.tint} size={40} />
                  <span className="flex flex-[1_1_220px] flex-col gap-0.5">
                    <span className="text-[17px] font-semibold">{row.member.name}</span>
                    <span className="text-sm font-medium text-red-text">
                      Blocked on {row.task.title}
                      {row.task.blocked?.why ? ` · "${row.task.blocked.why}"` : ""}
                    </span>
                  </span>
                  <span className="font-mono text-[13px] text-mute">
                    {done} of {row.tasks.length}
                  </span>
                  <span className="flex gap-2">
                    <a
                      href={`mailto:${row.member.email}?subject=${encodeURIComponent(`Re: ${row.task.title}`)}`}
                      className="inline-flex h-10 items-center rounded-[10px] border border-line bg-sheet px-4 text-sm font-semibold hover:bg-soft"
                    >
                      Help {row.member.name}
                    </a>
                    <button
                      type="button"
                      onClick={() => setBlocked(project.id, date, row.task.id, null)}
                      className="h-10 rounded-[10px] px-3 text-sm font-medium text-mute hover:bg-sheet hover:text-ink"
                    >
                      Cleared
                    </button>
                  </span>
                </li>
              );
            }
            if (row.kind === "request") {
              const { task, member } = row;
              return (
                <li key={`r-${task.id}`} className={`${rowClass} bg-amber-soft`}>
                  <Avatar name={member.name} tint={member.tint} size={40} />
                  <span className="flex flex-[1_1_220px] flex-col gap-0.5">
                    <span className="text-[17px] font-semibold">
                      {member.name} asks for {formatHours(task.request!.hours)}, not {formatHours(task.est ?? 0)}
                    </span>
                    <span className="text-sm text-mute">
                      {task.title}
                      {task.request!.why ? ` · "${task.request!.why}"` : ""} · {clock(new Date(task.request!.at), project.leadTz)}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => answerRequest(project.id, date, task.id, true)}
                      className="h-10 rounded-[10px] bg-ink px-4 text-sm font-semibold text-bg"
                    >
                      Give {formatHours(task.request!.hours)}
                    </button>
                    <button
                      type="button"
                      onClick={() => answerRequest(project.id, date, task.id, false)}
                      className="h-10 rounded-[10px] border border-line bg-sheet px-3.5 text-sm font-medium hover:bg-soft"
                    >
                      Keep {formatHours(task.est ?? 0)}
                    </button>
                  </span>
                </li>
              );
            }
            const { member, tasks, pct } = row;
            const sub = subtitle(member, tasks);
            const done = tasks.every((t) => t.done);
            return (
              <li key={`m-${member.id}`} className={rowClass}>
                <Avatar name={member.name} tint={member.tint} size={40} />
                <span className="flex flex-[1_1_220px] flex-col gap-0.5">
                  <span className="text-[17px] font-semibold">{member.name}</span>
                  <span className={`text-sm ${sub.tone}`}>{sub.text}</span>
                </span>
                <ProgressBar pct={pct} tone={done ? "green" : "ink"} className="w-[140px]" />
                <span className="font-mono text-[13px] text-mute">
                  {tasks.filter((t) => t.done).length} of {tasks.length}
                </span>
              </li>
            );
          })}
        </ul>
        <span className="text-sm text-mute">People who need you sit on top. Finished people sink to the bottom.</span>
      </main>
    </div>
  );
}

/* ---------- 5.2 Team finished ---------- */

function LiveDone({ project, paper }: { project: Project; paper: Paper }) {
  const router = useRouter();
  const { advanceDay, thankTeam } = useStore();
  const people = recipients(project, paper);
  const total = paper.tasks.filter((t) => t.assigneeId).length;
  const zones = new Set(people.map((m) => m.tz)).size;
  const next = weekday(nextWorkday(paper.date));

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-[520px] flex-col items-center gap-7 text-center">
        <BigCheck />
        <div className="flex flex-col gap-2">
          <span className="font-hand text-5xl leading-none font-bold sm:text-[56px]">Everyone&apos;s done.</span>
          <span className="text-[17px] text-mute">
            {total} of {total} tasks struck on {weekday(paper.date)}&apos;s paper
            {zones > 1 ? `, across ${zones === 2 ? "two" : zones === 3 ? "three" : zones} time zones` : ""}.
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-[22px]">
          {people.map((m) => {
            const at = finishedAt(paper, m.id);
            const local = !sameClock(m.tz, project.leadTz);
            return (
              <span key={m.id} className="flex flex-col items-center gap-1.5">
                <Avatar name={m.name} tint={m.tint} size={48} className="shadow-[0_0_0_3px_var(--green)]" />
                <span className="font-mono text-xs text-mute">
                  {at ? (local ? `${clock(at, m.tz)} ${m.city}` : clock(at, project.leadTz)) : "–"}
                </span>
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              advanceDay(project.id);
              router.push(`/projects/${project.id}/paper`);
            }}
            className={btn.primary}
          >
            Plan {next}&apos;s paper
          </button>
          <button type="button" disabled={paper.thanked} onClick={() => thankTeam(project.id, paper.date)} className={`${btn.outline} disabled:text-mute`}>
            {paper.thanked ? "Thanks sent" : "Say thanks to the team"}
          </button>
        </div>
        <Link href={`/projects/${project.id}`} className="text-sm font-medium text-mute hover:text-ink">
          Back to {project.name}
        </Link>
      </div>
    </div>
  );
}

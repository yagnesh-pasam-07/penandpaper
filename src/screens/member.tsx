"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Hydrated } from "@/components/hydration";
import { SignInPanel } from "@/components/sign-in";
import { BigCheck, CheckIcon, ChevronIcon, CloseIcon, PenIcon } from "@/components/icons";
import { AccountMenu, Avatar, BackButton, Logo, MemberShell, NotFound, ProgressBar, ThemeToggle, btn } from "@/components/ui";
import { formatHours, formatNum } from "@/lib/estimate";
import { paperFor } from "@/lib/mutations";
import { useStore } from "@/lib/store";
import { cleanStreak, greeting, hourIn, memberDone, sumEst, tasksOf } from "@/lib/selectors";
import { browserTz, clock, cityFromTz, longDate, nextWorkday, shortDate, weekday, ZONES } from "@/lib/time";
import type { CarryReason, Member, Paper, Project } from "@/lib/types";
import { useProject } from "@/lib/use-project";


/** The member this browser is in the routed project, plus today's sent paper. */
function useMemberDay(): { project?: Project; me?: Member; paper?: Paper } {
  const project = useProject();
  const viewer = useStore((s) => (project ? s.viewer[project.id] : undefined));
  const me = project?.members.find((m) => m.id === viewer);
  const paper = project ? paperFor(project, project.currentDate) : undefined;
  return { project, me, paper: paper?.status === "sent" ? paper : undefined };
}

function MemberGuard({ children }: { children: (ctx: { project: Project; me: Member; paper?: Paper }) => ReactNode }) {
  const { project, me, paper } = useMemberDay();
  const lead = useStore((s) => s.lead);
  if (!lead) return <NotFound what="Sign in to see your paper." href="/login?next=/me" cta="Sign in" />;
  if (!project) return <NotFound what="This project doesn't exist in this browser." href="/me" cta="My projects" />;
  if (!me) return <NotFound what="Join this project from your invite link first." href={`/join/${project.inviteCode}`} cta="Join" />;
  return <>{children({ project, me, paper })}</>;
}

function Screen({ children }: { children: (ctx: { project: Project; me: Member; paper?: Paper }) => ReactNode }) {
  return (
    <Hydrated>
      <MemberGuard>{children}</MemberGuard>
    </Hydrated>
  );
}

function TopRow({ back, backLabel, title }: { back: string; backLabel: string; title: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <BackButton href={back} label={backLabel} size={44} />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <ThemeToggle />
    </div>
  );
}

/* ---------- 3.3 Join from a phone ---------- */

export function JoinScreen() {
  return (
    <Hydrated>
      <Join />
    </Hydrated>
  );
}

type Preview = { id: string; name: string; leadName: string; joined: boolean; signedInAs: string | null };

function Join() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const joinProject = useStore((s) => s.joinProject);
  const [preview, setPreview] = useState<Preview | null | "loading">("loading");
  const detected = browserTz();
  const [zone, setZone] = useState(() => ZONES.find((z) => z.tz === detected) ?? { tz: detected, city: cityFromTz(detected) });
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/join/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Preview>) : null))
      .catch(() => null)
      .then((p) => live && setPreview(p));
    return () => {
      live = false;
    };
  }, [code]);

  if (preview === "loading") return <div className="min-h-dvh bg-bg" aria-busy="true" />;
  if (!preview) return <NotFound what="This invite link doesn't match a project." href="/" cta="Pen & Paper" />;
  if (preview.joined) {
    return <NotFound what={`You're already on ${preview.name}.`} href={`/me/${preview.id}`} cta="Open my paper" />;
  }
  const project = preview;
  const leadName = preview.leadName;
  const zoneOptions = ZONES.some((z) => z.city === zone.city) ? ZONES : [zone, ...ZONES];

  return (
    <MemberShell className="gap-[26px] pt-8">
      <div className="flex items-center justify-between">
        <Logo size="sm" />
        <ThemeToggle />
      </div>

      <div className="flex flex-col gap-3.5">
        <Avatar name={leadName} size={52} />
        <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em]">
          {leadName} added you to <span className="font-hand text-4xl font-bold text-red-text">{project.name}</span>
        </h1>
      </div>

      <div className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-sheet p-[18px]">
        <span className="text-[13px] text-mute">How your day will work</span>
        {["Your paper arrives at 9:00, your time.", "Tap a task to strike it out.", "Need more time? Say so in one tap."].map((line, i) => (
          <span key={line} className="flex items-baseline gap-3 text-[15px]">
            <span className="w-4 font-hand text-2xl font-bold text-red-text">{i + 1}</span>
            {line}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2 text-sm text-mute">
        <span className="flex items-center justify-between">
          <span>
            Your time zone: <span className="font-medium text-ink">{zone.city === cityFromTz(zone.tz) ? zone.city : `${zone.city} (${zone.tz})`}</span>
          </span>
          <button type="button" onClick={() => setPicking(!picking)} className="py-2 font-semibold text-ink">
            {picking ? "Done" : "Change"}
          </button>
        </span>
        {picking && (
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">Time zone</span>
            <select
              value={`${zone.tz}|${zone.city}`}
              onChange={(e) => {
                const [tz, city] = e.target.value.split("|");
                setZone({ tz, city });
              }}
              className="h-12 rounded-xl border border-line bg-sheet px-3 text-[15px] text-ink"
            >
              {zoneOptions.map((z) => (
                <option key={`${z.tz}|${z.city}`} value={`${z.tz}|${z.city}`}>
                  {z.city} · {z.tz}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        {preview.signedInAs ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const joined = await joinProject(code, zone.tz, zone.city);
                setBusy(false);
                if (joined) router.push(`/me/${joined.projectId}`);
              }}
              className={`${btn.primary} h-[54px] disabled:opacity-50`}
            >
              {busy ? "Joining…" : `Join ${project.name}`}
            </button>
            <span className="text-center text-[13px] text-mute">as {preview.signedInAs}</span>
          </>
        ) : (
          <SignInPanel next={`/join/${code}`} mode="signup" switchInline />
        )}
      </div>
    </MemberShell>
  );
}

/* ---------- 6.1 9:00, the paper arrives ---------- */

export function NotifyScreen() {
  return <Screen>{(ctx) => <Notify {...ctx} />}</Screen>;
}

function Notify({ project, me, paper }: { project: Project; me: Member; paper?: Paper }) {
  const mine = paper ? tasksOf(paper, me.id) : [];
  return (
    <div className="ruled min-h-dvh bg-soft">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-9 px-4 pt-[72px] pb-8">
        <div className="flex flex-col gap-0.5">
          <span className="text-[17px] font-medium text-mute">{longDate(project.currentDate)}</span>
          <span className="text-[88px] leading-none font-semibold tracking-[-0.04em]">9:00</span>
        </div>

        {paper && mine.length ? (
          <Link
            href={`/me/${project.id}/today`}
            className="flex w-full items-center gap-3 rounded-[22px] bg-sheet p-4 shadow-[0_18px_40px_-20px_var(--shadow)]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-red text-on-red">
              <PenIcon size={22} />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="flex justify-between text-[13px] text-mute">
                <span className="font-semibold tracking-[0.02em]">PEN &amp; PAPER</span>
                <span>now</span>
              </span>
              <span className="text-base font-semibold">Your {weekday(project.currentDate)} paper is ready</span>
              <span className="text-[15px] text-mute">
                {mine.length} {mine.length === 1 ? "task" : "tasks"} · {formatHours(sumEst(mine))} · from {project.leadName}
              </span>
            </span>
          </Link>
        ) : (
          <div className="rounded-[22px] bg-sheet p-4 text-[15px] text-mute">No paper for you yet today. It arrives at 9:00 your time.</div>
        )}

        <div className="mt-auto flex flex-col gap-2.5 text-center">
          <span className="font-hand text-[26px] font-semibold text-mute">arrives at 9:00 wherever you are</span>
          <span className="text-[13px] text-mute">Also by email or a Slack message, if you prefer.</span>
          <Link href={`/me/${project.id}`} className="pt-2 text-sm font-semibold">
            Open Pen &amp; Paper
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- 6.2 My projects ---------- */

export function MyProjectsScreen() {
  return (
    <Hydrated>
      <MyProjects />
    </Hydrated>
  );
}

function MyProjects() {
  const projects = useStore((s) => s.projects);
  const viewer = useStore((s) => s.viewer);
  const mine = projects
    .map((p) => ({ project: p, me: p.members.find((m) => m.id === viewer[p.id]) }))
    .filter((x): x is { project: Project; me: Member } => Boolean(x.me));
  const first = mine[0];
  const account = useStore((s) => s.lead);
  const signOut = useStore((s) => s.signOut);
  const router = useRouter();
  if (!account) return <NotFound what="Sign in to see your paper." href="/login?next=/me" cta="Sign in" />;

  return (
    <MemberShell className="gap-7 pt-8">
      <div className="flex items-center justify-between">
        <Logo size="sm" />
        <span className="flex items-center gap-1">
          <ThemeToggle />
          {account && (
            <AccountMenu
              name={first?.me.name ?? account.name}
              email={account.email}
              tint={first?.me.tint}
              onSignOut={async () => {
                await signOut();
                router.push("/");
              }}
            />
          )}
        </span>
      </div>

      {first ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] text-mute">{shortDate(first.project.currentDate).replace(/^\w+/, weekday(first.project.currentDate))}</span>
            <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.02em]">
              {greeting(hourIn(first.me.tz))}, {first.me.name}.
            </h1>
          </div>
          <div className="flex flex-col gap-3">
            {mine.map(({ project, me }) => {
              const paper = paperFor(project, project.currentDate);
              const sent = paper?.status === "sent" ? paper : undefined;
              const myTasks = sent ? tasksOf(sent, me.id) : [];
              const ready = myTasks.length > 0 && !memberDone(sent!, me.id);
              const status = !myTasks.length ? "Nothing for you today" : ready ? "Today's paper is ready" : "Paper done";
              return (
                <Link
                  key={project.id}
                  href={`/me/${project.id}`}
                  className={`flex items-center gap-3.5 rounded-[20px] bg-sheet p-[18px] ${ready ? "border-[1.5px] border-ink" : "border border-line"}`}
                >
                  <span className={`flex size-[46px] shrink-0 items-center justify-center rounded-[14px] font-hand text-[26px] font-bold ${ready ? "bg-t4" : "bg-t3"}`}>
                    {project.name.charAt(0)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[17px] font-semibold">{project.name}</span>
                    <span className={`text-sm ${ready ? "font-medium text-red-text" : status === "Paper done" ? "font-medium text-green" : "text-mute"}`}>{status}</span>
                  </span>
                  <ChevronIcon size={18} />
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="font-hand text-[40px] font-bold">No papers yet.</span>
          <span className="max-w-[280px] text-mute">Open the invite link your lead sent you, and your paper will show up here.</span>
        </div>
      )}
    </MemberShell>
  );
}

/* ---------- 6.3 Papers ---------- */

export function PapersScreen() {
  return <Screen>{(ctx) => <Papers {...ctx} />}</Screen>;
}

function Papers({ project, me, paper }: { project: Project; me: Member; paper?: Paper }) {
  const mine = paper ? tasksOf(paper, me.id) : [];
  const allDone = paper ? memberDone(paper, me.id) : false;
  const earlier = project.papers
    .filter((p) => p.status === "sent" && p.date < project.currentDate && tasksOf(p, me.id).length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <MemberShell className="gap-6">
      <TopRow back="/me" backLabel="Back to projects" title={<span className="text-lg font-semibold">{project.name}</span>} />

      {mine.length ? (
        <Link
          href={`/me/${project.id}/today`}
          className="flex flex-col gap-[18px] rounded-[6px_6px_20px_20px] border-[1.5px] border-ink bg-sheet p-[22px] shadow-[0_20px_36px_-26px_var(--shadow)]"
        >
          <span className="flex items-baseline justify-between">
            <span className="font-hand text-[38px] leading-none font-bold">Today</span>
            <span className="text-sm text-mute">{shortDate(project.currentDate)}</span>
          </span>
          <span className="flex flex-col gap-2.5 text-base">
            {mine.map((t) => (
              <span key={t.id} className="flex justify-between gap-3">
                <span className={t.done ? "strike text-mute" : ""}>{t.title}</span>
                <span className="font-mono text-[13px] text-mute">{formatHours(t.est ?? 0)}</span>
              </span>
            ))}
          </span>
          <span className={`flex h-[52px] items-center justify-center rounded-[14px] text-base font-semibold ${allDone ? "bg-green-soft text-green" : "bg-red text-on-red"}`}>
            {allDone ? "Paper done" : "Open my paper"}
          </span>
        </Link>
      ) : (
        <div className="rounded-[20px] border border-dashed border-line p-[22px] text-mute">
          <span className="font-hand text-[30px] font-bold text-ink">Today</span>
          <p className="pt-2 text-[15px]">
            {paper ? "Nothing on your paper today." : `${weekday(project.currentDate)}'s paper isn't out yet. It arrives at 9:00 your time.`}
          </p>
        </div>
      )}

      {earlier.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="pb-1.5 text-[13px] text-mute">Earlier</span>
          {earlier.map((p, i) => {
            const open = tasksOf(p, me.id).filter((t) => !t.done).length;
            return (
              <span key={p.date} className={`flex items-center gap-3 px-1 py-3.5 ${i < earlier.length - 1 ? "border-b border-line" : ""}`}>
                {open === 0 ? (
                  <span className="flex size-[22px] items-center justify-center rounded-full bg-green text-bg">
                    <CheckIcon />
                  </span>
                ) : (
                  <span className="size-[22px] rounded-full border-2 border-dashed border-amber" aria-hidden="true" />
                )}
                <span className="flex-1">{shortDate(p.date)}</span>
                <span className="text-[13px] text-mute">{open === 0 ? "all done" : `${open} moved on`}</span>
              </span>
            );
          })}
        </div>
      )}
    </MemberShell>
  );
}

/* ---------- 6.4 Today · tap to strike ---------- */

export function TodayScreen() {
  return <Screen>{(ctx) => <Today {...ctx} />}</Screen>;
}

function Today({ project, me, paper }: { project: Project; me: Member; paper?: Paper }) {
  const router = useRouter();
  const toggleDone = useStore((s) => s.toggleDone);
  const mine = paper ? tasksOf(paper, me.id) : [];
  const back = `/me/${project.id}`;

  if (!paper || !mine.length) {
    return (
      <MemberShell className="gap-6">
        <TopRow back={back} backLabel="Back to papers" title={<span className="text-[15px] text-mute">{project.name}</span>} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="font-hand text-[40px] font-bold">Nothing here yet.</span>
          <span className="text-mute">Your paper arrives at 9:00 your time.</span>
        </div>
      </MemberShell>
    );
  }

  const total = sumEst(mine);
  const doneHours = sumEst(mine.filter((t) => t.done));
  const doneCount = mine.filter((t) => t.done).length;
  const allDone = doneCount === mine.length;

  const strike = (taskId: string, wasDone: boolean) => {
    toggleDone(project.id, paper.date, taskId);
    const finishing = !wasDone && doneCount === mine.length - 1;
    if (finishing) setTimeout(() => router.push(`/me/${project.id}/done`), 650);
  };

  return (
    <MemberShell className="gap-6">
      <TopRow back={back} backLabel="Back to papers" title={<span className="text-[15px] text-mute">{project.name}</span>} />

      {allDone ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[18px] text-center">
          <BigCheck />
          <span className="font-hand text-[50px] leading-none font-bold">Paper done.</span>
          <span className="max-w-[260px] text-base text-mute">Every task struck out. {project.leadName} can see it already.</span>
          <button
            type="button"
            onClick={() => {
              const last = [...mine].sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))[0];
              toggleDone(project.id, paper.date, last.id);
            }}
            className="h-11 rounded-xl border border-line bg-sheet px-[18px] text-[15px] font-medium"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="font-hand text-[44px] leading-none font-bold">{weekday(paper.date)}</span>
            <span className="text-[15px] text-mute">
              {doneCount} of {mine.length} done · {formatHours(total - doneHours)} left
            </span>
            <ProgressBar pct={total ? (doneHours / total) * 100 : 0} tone="red" height={8} />
          </div>

          <div className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-sheet">
            {mine.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => strike(t.id, t.done)}
                aria-pressed={t.done}
                className={`flex min-h-[76px] items-center gap-4 px-5 text-left ${i < mine.length - 1 ? "border-b border-line" : ""}`}
              >
                {t.done ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red text-on-red">
                    <CheckIcon size={14} />
                  </span>
                ) : (
                  <span className="size-7 shrink-0 rounded-full border-2 border-red-text" aria-hidden="true" />
                )}
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className={`text-[17px] ${t.done ? "strike text-mute" : "font-medium"}`}>{t.title}</span>
                  {!t.done && t.request?.state === "pending" && <span className="text-[13px] text-amber">asked for {formatHours(t.request.hours)}</span>}
                  {!t.done && t.request?.state === "given" && <span className="text-[13px] text-green">{project.leadName} gave {formatHours(t.request.hours)}</span>}
                  {!t.done && t.request?.state === "kept" && <span className="text-[13px] text-mute">kept at {formatHours(t.est ?? 0)}</span>}
                  {!t.done && t.blocked && <span className="text-[13px] text-red-text">stuck · {t.blocked.why}</span>}
                </span>
                <span className="font-mono text-[13px] text-mute">{formatHours(t.est ?? 0)}</span>
              </button>
            ))}
          </div>

          <span className="text-center font-hand text-[22px] text-mute">tap a task to strike it out</span>
          <div className="mt-auto flex flex-col gap-1">
            <Link
              href={`/me/${project.id}/today/more-time`}
              className="flex h-[52px] items-center justify-center rounded-[14px] border border-line bg-sheet text-[15px] font-medium"
            >
              Need more time, or stuck?
            </Link>
            <Link href={`/me/${project.id}/carry`} className="flex h-11 items-center justify-center text-sm text-mute">
              Close my day
            </Link>
          </div>
        </div>
      )}
    </MemberShell>
  );
}

/* ---------- 6.5 Ask for more time ---------- */

export function MoreTimeScreen() {
  return <Screen>{(ctx) => <MoreTime {...ctx} />}</Screen>;
}

function MoreTime({ project, me, paper }: { project: Project; me: Member; paper?: Paper }) {
  const router = useRouter();
  const { requestTime, setBlocked } = useStore();
  const open = paper ? tasksOf(paper, me.id).filter((t) => !t.done) : [];
  const [taskId, setTaskId] = useState(open[0]?.id);
  const [hours, setHours] = useState<number | null>(null);
  const [why, setWhy] = useState("");
  const today = `/me/${project.id}/today`;
  const task = open.find((t) => t.id === taskId) ?? open[0];
  const leadName = project.leadName;

  if (!paper || !task) return <NotFound what="Nothing open on your paper." href={today} cta="Back to today" />;
  const planned = task.est ?? 0;
  const options = [-1, 0, 1, 2, 3].map((d) => planned + d).filter((h) => h > 0);

  return (
    <div className="min-h-dvh bg-bg">
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden">
        <div aria-hidden="true" className="flex flex-col gap-5 px-[22px] py-7">
          <span className="font-hand text-[44px] leading-none font-bold">{weekday(paper.date)}</span>
          <div className="flex flex-col rounded-[20px] border border-line bg-sheet">
            {tasksOf(paper, me.id).map((t, i, all) => (
              <span key={t.id} className={`flex min-h-[72px] items-center gap-4 px-5 ${i < all.length - 1 ? "border-b border-line" : ""}`}>
                <span className={`size-7 rounded-full ${t.done ? "bg-red" : "border-2 border-red-text"}`} />
                <span className={`flex-1 text-[17px] ${t.done ? "strike text-mute" : ""}`}>{t.title}</span>
              </span>
            ))}
          </div>
        </div>
        <Link href={today} aria-label="Close" className="absolute inset-0 bg-scrim" />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ask for more time"
          className="absolute inset-x-0 bottom-0 flex flex-col gap-5 rounded-t-[26px] bg-sheet px-[22px] pt-3 pb-7"
        >
          <span className="h-[5px] w-10 self-center rounded-full bg-line" aria-hidden="true" />
          {open.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Which task">
              {open.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={t.id === task.id}
                  onClick={() => {
                    setTaskId(t.id);
                    setHours(null);
                  }}
                  className={`h-9 rounded-full px-3.5 text-sm ${t.id === task.id ? "bg-ink text-bg" : "border border-line"}`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xl font-semibold">{task.title}</span>
              <span className="text-sm text-mute">
                {leadName} planned <span className="font-mono">{formatHours(planned)}</span>
              </span>
            </div>
            <Link href={today} aria-label="Close" className="flex size-10 items-center justify-center rounded-full text-mute hover:bg-soft">
              <CloseIcon />
            </Link>
          </div>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="pb-2.5 text-[15px] font-medium">How long will it really take?</legend>
            <div className="grid grid-cols-5 gap-2">
              {options.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={hours === h}
                  disabled={h === planned}
                  onClick={() => setHours(h)}
                  className={`h-12 rounded-xl font-mono text-[15px] ${
                    hours === h ? "border-2 border-ink bg-ink font-semibold text-bg" : `border border-line bg-sheet ${h === planned ? "text-mute" : ""}`
                  }`}
                >
                  {formatHours(h)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-2 text-sm text-mute">
            Why, in a line (optional)
            <input
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="3 edge cases in carry-forward"
              className="h-12 rounded-xl border border-line bg-bg px-3.5 text-[15px] text-ink outline-none placeholder:text-mute"
            />
          </label>
          <button
            type="button"
            disabled={hours === null}
            onClick={() => {
              if (hours === null) return;
              requestTime(project.id, paper.date, task.id, hours, why.trim());
              router.push(today);
            }}
            className={`${btn.primary} disabled:opacity-50`}
          >
            {hours === null ? `Ask ${leadName} for more time` : `Ask ${leadName} for ${formatHours(hours)}`}
          </button>
          <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-mute">
              Keeps {formatHours(planned)} until {leadName} answers.
            </span>
            <span className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setBlocked(project.id, paper.date, task.id, why.trim() || "stuck");
                  router.push(today);
                }}
                className="py-2 font-semibold"
              >
                I&apos;m stuck
              </button>
              <Link href={`/me/${project.id}/carry`} className="py-2 font-semibold">
                Can&apos;t do it today
              </Link>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- 6.6 Paper done ---------- */

export function DoneScreen() {
  return <Screen>{(ctx) => <Done {...ctx} />}</Screen>;
}

function Done({ project, me, paper }: { project: Project; me: Member; paper?: Paper }) {
  const router = useRouter();
  const closeDay = useStore((s) => s.closeDay);
  if (!paper || !memberDone(paper, me.id)) {
    return <NotFound what="There's still something on your paper." href={`/me/${project.id}/today`} cta="Back to today" />;
  }
  const mine = tasksOf(paper, me.id);
  const streak = cleanStreak(project, me.id, paper.date);

  return (
    <MemberShell className="gap-6 overflow-hidden">
      <div aria-hidden="true">
        <span className="absolute top-[150px] left-10 h-4 w-2.5 -rotate-[24deg] rounded bg-t1" />
        <span className="absolute top-[170px] right-[50px] size-3 rounded-full bg-t4" />
        <span className="absolute top-[110px] right-[70px] h-3 w-2 rotate-30 rounded-[3px] bg-t3" />
        <span className="absolute top-[330px] left-[66px] h-3 w-1.5 rotate-[18deg] rounded-[2px] bg-red" />
        <span className="absolute top-[320px] right-[42px] h-2.5 w-4 rounded-full bg-t5" />
      </div>
      <span className="relative text-[15px] text-mute">
        {shortDate(paper.date)} · {clock(new Date(), me.tz)}
      </span>
      <div className="relative flex flex-1 flex-col items-center justify-center gap-[18px] text-center">
        <BigCheck size={150} />
        <span className="font-hand text-[56px] leading-none font-bold">Paper done.</span>
        <span className="max-w-[270px] text-[17px] text-mute">
          {mine.length} {mine.length === 1 ? "task" : "tasks"}, {formatNum(sumEst(mine))} hours, all struck out. That&apos;s a good day.
        </span>
        {streak >= 2 && (
          <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-sheet px-4 py-2.5 text-sm">
            <span className="font-hand text-2xl leading-none font-bold text-red-text">{streak}</span>
            clean papers in a row
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          closeDay(project.id, paper.date, me.id);
          router.push("/me");
        }}
        className={`${btn.ink} relative`}
      >
        Done for today
      </button>
    </MemberShell>
  );
}

/* ---------- 6.7 Day ends, carry over ---------- */

const REASONS: CarryReason[] = ["Took longer", "Blocked", "Other work", "Unclear"];

export function CarryScreen() {
  return <Screen>{(ctx) => <Carry {...ctx} />}</Screen>;
}

function Carry({ project, me, paper }: { project: Project; me: Member; paper?: Paper }) {
  const router = useRouter();
  const closeDay = useStore((s) => s.closeDay);
  const [reason, setReason] = useState<CarryReason | undefined>(paper?.closed[me.id]?.reason);
  if (!paper) return <NotFound what="No paper today." href={`/me/${project.id}`} cta="Back" />;
  const mine = tasksOf(paper, me.id);
  const open = mine.filter((t) => !t.done);
  if (!open.length) return <NotFound what="Everything is struck. Nice." href={`/me/${project.id}/done`} cta="See your day" />;
  const done = mine.length - open.length;
  const tomorrow = weekday(nextWorkday(paper.date));

  return (
    <MemberShell className="gap-[26px]">
      <span className="flex items-center justify-between text-[15px] text-mute">
        {shortDate(paper.date)} · {clock(new Date(), me.tz)}
        <ThemeToggle />
      </span>
      <div className="flex flex-col gap-2">
        <span className="font-hand text-[46px] leading-none font-bold">{done ? "Nearly there." : "Tomorrow, then."}</span>
        <span className="text-base text-mute">
          {done} of {mine.length} done. The rest moves to tomorrow, nothing is lost.
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {open.map((t) => (
          <div key={t.id} className="flex items-center gap-3.5 rounded-[18px] border border-line bg-sheet p-[18px]">
            <span className="size-7 shrink-0 rounded-full border-2 border-dashed border-amber" aria-hidden="true" />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[17px] font-medium">{t.title}</span>
              <span className="text-[13px] text-amber">→ {tomorrow}&apos;s paper</span>
            </span>
            <span className="font-mono text-[13px] text-mute">{formatHours(t.est ?? 0)}</span>
          </div>
        ))}
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-3 text-[15px] font-semibold">What slowed it down?</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => setReason(reason === r ? undefined : r)}
              className={`h-11 rounded-full px-4 text-[15px] font-medium ${reason === r ? "border-[1.5px] border-ink bg-ink text-bg" : "border border-line bg-sheet"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-mute">One tap. Your lead sees this, so tomorrow&apos;s plan is better.</span>
      </fieldset>
      <div className="mt-auto flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            closeDay(project.id, paper.date, me.id, reason);
            router.push("/me");
          }}
          className={btn.primary}
        >
          Close today&apos;s paper
        </button>
        <Link href={`/me/${project.id}/today`} className="flex h-11 items-center justify-center text-sm text-mute">
          Not yet, back to my paper
        </Link>
      </div>
    </MemberShell>
  );
}

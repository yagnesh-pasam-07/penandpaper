"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Hydrated } from "@/components/hydration";
import { CheckIcon, ChevronIcon, CloseIcon, NotebookIcon, PlusIcon } from "@/components/icons";
import { AccountMenu, Avatar, Breadcrumb, LeadHeader, Logo, Modal, NotFound, btn, tintClass } from "@/components/ui";
import { paperFor } from "@/lib/mutations";
import { useStore } from "@/lib/store";
import { recipients } from "@/lib/selectors";
import { shortDate, weekday } from "@/lib/time";
import type { Project, Tint } from "@/lib/types";
import { useProject } from "@/lib/use-project";

function LeadAvatar() {
  const router = useRouter();
  const lead = useStore((s) => s.lead);
  const signOut = useStore((s) => s.signOut);
  if (!lead) return null;
  return (
    <AccountMenu
      name={lead.name}
      email={lead.email}
      onSignOut={async () => {
        await signOut();
        router.push("/");
      }}
    />
  );
}

export { LeadAvatar };

/** Lead screens need an account; this keeps the guard in one place. */
function RequireLead({ children }: { children: ReactNode }) {
  const lead = useStore((s) => s.lead);
  if (!lead) return <NotFound what="Sign in to plan your team's day." href="/signup" cta="Sign in" />;
  return <>{children}</>;
}

/* ---------- 2.1 Projects (empty state, or the list) ---------- */

export function ProjectsScreen() {
  return (
    <Hydrated>
      <RequireLead>
        <Projects />
      </RequireLead>
    </Hydrated>
  );
}

function Projects() {
  const projects = useStore((s) => s.projects).filter((p) => p.isOwner);
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LeadHeader left={<Logo />} right={<LeadAvatar />} />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-8 px-4 pt-6 pb-20 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[34px] font-semibold tracking-[-0.02em]">Projects</h1>
          {projects.length > 0 && (
            <Link href="/projects/new" className={btn.primarySm}>
              <PlusIcon />
              New project
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="flex min-h-[520px] flex-1 flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-line px-6 py-10 text-center">
            <NotebookIcon />
            <div className="flex flex-col gap-2">
              <span className="font-hand text-[40px] font-bold">A blank notebook.</span>
              <span className="max-w-[360px] text-base text-mute">Make a project for each team or product. Papers and people live inside it.</span>
            </div>
            <Link href="/projects/new" className={btn.primary}>
              <PlusIcon />
              New project
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
            {projects.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const paper = paperFor(project, project.currentDate);
  const status =
    paper?.status === "sent"
      ? `${weekday(project.currentDate)}'s paper is out`
      : paper
        ? `${weekday(project.currentDate)}'s paper is a draft`
        : project.members.length
          ? `Plan ${weekday(project.currentDate)}'s paper`
          : "Invite your team";
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex items-center gap-4 rounded-[20px] border border-line bg-sheet p-5 hover:border-ink"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-t4 font-hand text-[26px] font-bold">
        {project.name.charAt(0)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[17px] font-semibold">{project.name}</span>
        <span className="text-sm text-mute">
          {project.members.length} {project.members.length === 1 ? "person" : "people"} · {status}
        </span>
      </span>
      <ChevronIcon size={18} />
    </Link>
  );
}

/* ---------- 2.2 New project ---------- */

export function NewProjectScreen() {
  return (
    <Hydrated>
      <RequireLead>
        <NewProject />
      </RequireLead>
    </Hydrated>
  );
}

function NewProject() {
  const router = useRouter();
  const createProject = useStore((s) => s.createProject);
  const [name, setName] = useState("");
  const [hours, setHours] = useState<6 | 8>(8);

  return (
    <Modal label="New project" closeHref="/projects">
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = createProject(name.trim(), hours);
          router.push(`/projects/${id}`);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-hand text-4xl leading-none font-bold">New project</span>
          <span className="text-[15px] text-mute">Two things, then you&apos;re planning.</span>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Atlas HR platform"
            required
            className="h-[52px] rounded-[14px] border-[1.5px] border-ink bg-sheet px-4 text-[17px] font-normal outline-none placeholder:text-mute"
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-medium">Working hours per person, per day</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {([6, 8] as const).map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={hours === h}
                onClick={() => setHours(h)}
                className={`h-[52px] rounded-[14px] font-mono text-base ${hours === h ? "border-2 border-ink bg-soft font-semibold" : "border border-line bg-sheet"}`}
              >
                {h}h
              </button>
            ))}
          </div>
          <span className="text-[13px] text-mute">You can change it per person later.</span>
        </fieldset>
        <div className="flex justify-end gap-2.5">
          <Link href="/projects" className={btn.ghost}>
            Cancel
          </Link>
          <button type="submit" disabled={!name.trim()} className={`${btn.primarySm} disabled:opacity-50`}>
            Create project
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- 2.3 Project created / 3.2 Invites sent ---------- */

export function ProjectHomeScreen() {
  return (
    <Hydrated>
      <RequireLead>
        <ProjectHome />
      </RequireLead>
    </Hydrated>
  );
}

function Step({
  n,
  title,
  sub,
  state,
  href,
  aside,
}: {
  n: number;
  title: string;
  sub: string;
  state: "next" | "later" | "done";
  href?: string;
  aside?: ReactNode;
}) {
  if (state === "done") {
    return (
      <div className="flex items-center gap-5 rounded-[20px] border border-line bg-sheet p-5 sm:p-6">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-green text-bg">
          <CheckIcon size={22} strokeWidth={2} />
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <span className="strike text-[19px] font-semibold text-mute">{title}</span>
          <span className="text-[15px] text-mute">{sub}</span>
        </span>
        {aside}
      </div>
    );
  }
  if (state === "later" || !href) {
    return (
      <div className="flex items-center gap-5 rounded-[20px] border border-dashed border-line p-5 text-mute sm:p-6">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-line font-hand text-3xl font-bold">
          {n}
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <span className="text-[19px] font-semibold">{title}</span>
          <span className="text-[15px]">{sub}</span>
        </span>
      </div>
    );
  }
  return (
    <Link href={href} className="flex items-center gap-5 rounded-[20px] border-[1.5px] border-ink bg-sheet p-5 sm:p-6">
      <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-red font-hand text-3xl font-bold text-on-red">
        {n}
      </span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-[19px] font-semibold">{title}</span>
        <span className="text-[15px] text-mute">{sub}</span>
      </span>
      <ChevronIcon />
    </Link>
  );
}

function ProjectHome() {
  const project = useProject();
  if (!project?.isOwner) return <NotFound what="This project doesn't exist, or you don't lead it." href="/projects" cta="All projects" />;

  const paper = paperFor(project, project.currentDate);
  const sent = paper?.status === "sent";
  const day = weekday(project.currentDate);
  const invited = project.members.length;
  const joined = project.members.filter((m) => m.status === "joined").length;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LeadHeader left={<Breadcrumb href="/projects" label="Projects" />} right={<LeadAvatar />} />
      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-9 px-4 pt-10 pb-20 sm:px-8">
        <div className="flex flex-col gap-2.5">
          {!project.invitesSent && (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-green-soft px-3 py-1.5 text-[13px] font-semibold text-green">
              <CheckIcon size={12} strokeWidth={2} />
              Project created
            </span>
          )}
          <h1 className="text-4xl font-semibold tracking-[-0.025em] sm:text-[44px]">{project.name}</h1>
          {project.invitesSent ? (
            <span className="flex flex-wrap items-center gap-2.5 text-[15px] text-mute">
              <span className="flex">
                {project.members.slice(0, 6).map((m, i) => (
                  <Avatar key={m.id} name={m.name} tint={m.tint} className={`border-2 border-bg ${i ? "-ml-2" : ""}`} />
                ))}
              </span>
              {joined === invited
                ? `${invited} ${invited === 1 ? "person" : "people"} on the team`
                : `${invited} invited${joined ? ` · ${joined} joined` : ""} · they'll show up as they join`}
            </span>
          ) : (
            <p className="text-[17px] text-mute">Two steps and your team has a plan for tomorrow morning.</p>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          {project.invitesSent ? (
            <Step
              n={1}
              title="Invite your team"
              sub={`${invited} ${invited === 1 ? "invite" : "invites"} sent`}
              state="done"
              aside={
                <Link href={`/projects/${project.id}/invite`} className="p-2.5 text-sm font-semibold">
                  Add more
                </Link>
              }
            />
          ) : (
            <Step n={1} title="Invite your team" sub="Each person gets a bucket on every paper." state="next" href={`/projects/${project.id}/invite`} />
          )}
          {sent && paper ? (
            <>
              <Step n={2} title={`Plan ${day}'s paper`} sub={`Sent to ${recipients(project, paper).length} people`} state="done" />
              <Step n={3} title="Watch the day" sub="Only what needs you rises to the top." state="next" href={`/projects/${project.id}/live`} />
            </>
          ) : (
            <Step
              n={2}
              title={paper ? `Finish ${day}'s paper` : "Plan today's paper"}
              sub={paper ? `Draft for ${shortDate(project.currentDate)}` : "Drop thoughts, add times, drag to people."}
              state={project.invitesSent ? "next" : "later"}
              href={paper ? `/projects/${project.id}/paper/plan` : `/projects/${project.id}/paper`}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- 3.1 Invite people ---------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHIP_TINTS: Tint[] = ["t4", "t3", "t2", "t1", "t5"];

export function InviteScreen() {
  return (
    <Hydrated>
      <RequireLead>
        <Invite />
      </RequireLead>
    </Hydrated>
  );
}

function Invite() {
  const router = useRouter();
  const project = useProject();
  const addInvites = useStore((s) => s.addInvites);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!project?.isOwner) return <NotFound what="This project doesn't exist, or you don't lead it." href="/projects" cta="All projects" />;
  const back = `/projects/${project.id}`;
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/join/${project.inviteCode}`;
  const linkLabel = link.replace(/^https?:\/\//, "");

  /** Turns typed or pasted text into chips; returns what couldn't be read. */
  const commit = (text: string): string => {
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    const bad: string[] = [];
    const next = [...emails];
    for (const raw of parts) {
      const email = raw.toLowerCase();
      if (!EMAIL.test(email)) bad.push(raw);
      else if (!next.includes(email) && !project.members.some((m) => m.email === email)) next.push(email);
    }
    setEmails(next);
    setError(bad.length ? `"${bad.join(", ")}" doesn't look like an email.` : "");
    return bad.join(" ");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " ", "Tab"].includes(e.key) && draft.trim()) {
      e.preventDefault();
      setDraft(commit(draft));
    } else if (e.key === "Backspace" && !draft && emails.length) {
      setEmails(emails.slice(0, -1));
    }
  };

  // Typed-but-not-yet-chipped emails count too.
  const pending = draft
    .split(/[\s,;]+/)
    .map((e) => e.toLowerCase())
    .filter((e) => EMAIL.test(e) && !emails.includes(e));
  const count = emails.length + pending.length;

  const send = () => {
    if (!count) return;
    addInvites(project.id, [...emails, ...pending]);
    router.push(back);
  };

  return (
    <Modal label="Invite people" closeHref={back} maxWidth={500}>
      <div className="flex flex-col gap-1.5">
        <span className="font-hand text-4xl leading-none font-bold">Who&apos;s on the team?</span>
        <span className="text-[15px] text-mute">Add emails, press Enter after each one.</span>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Emails
        <span className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-[14px] border-[1.5px] border-ink bg-sheet px-3 py-2.5">
          {emails.map((email, i) => (
            <span key={email} className={`inline-flex h-8 items-center gap-1.5 rounded-full pr-1.5 pl-3 text-sm font-normal ${tintClass(CHIP_TINTS[i % CHIP_TINTS.length])}`}>
              {email}
              <button
                type="button"
                aria-label={`Remove ${email}`}
                onClick={() => setEmails(emails.filter((e) => e !== email))}
                className="flex size-[22px] items-center justify-center rounded-full hover:bg-sheet/60"
              >
                <CloseIcon size={12} />
              </button>
            </span>
          ))}
          <input
            type="email"
            aria-label={emails.length ? "Add another email" : "Email"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (/[\s,;]/.test(text.trim())) {
                e.preventDefault();
                setDraft(commit(text));
              }
            }}
            onBlur={() => draft.trim() && setDraft(commit(draft))}
            placeholder={emails.length ? "" : "asha@company.com"}
            className="h-8 min-w-[120px] flex-1 bg-transparent text-[15px] font-normal outline-none placeholder:text-mute focus-visible:outline-none"
          />
        </span>
        {error && (
          <span role="alert" className="text-[13px] font-normal text-red-text">
            {error}
          </span>
        )}
      </label>

      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-soft px-4 py-3.5 text-sm">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">Or share a link</span>
          <span className="truncate font-mono text-xs text-mute">{linkLabel}</span>
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setCopied(false);
            }
          }}
          className="h-10 shrink-0 rounded-[10px] border border-line bg-sheet px-3.5 text-sm font-medium hover:bg-soft"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex justify-end gap-2.5">
        <Link href={back} className={btn.ghost}>
          Later
        </Link>
        <button type="button" onClick={send} disabled={count === 0} className={`${btn.primarySm} disabled:opacity-50`}>
          {count === 0 ? "Send invites" : `Send ${count} ${count === 1 ? "invite" : "invites"}`}
        </button>
      </div>
    </Modal>
  );
}

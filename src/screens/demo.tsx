"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hydrated } from "@/components/hydration";
import { LeadHeader, Logo, btn } from "@/components/ui";
import { DEMO_LEAD, DEMO_PROJECT_NAME } from "@/lib/demo";
import { useStore } from "@/lib/store";

/** Every screen from the design canvas, grouped by the story's rows. */
function rows(id: string, code: string): { title: string; screens: { id: string; name: string; href: string }[] }[] {
  return [
  {
    title: "1  Monday: Yagnesh finds Pen & Paper",
    screens: [
      { id: "1.1", name: "Landing", href: "/" },
      { id: "1.2", name: "Sign up", href: "/signup" },
    ],
  },
  {
    title: "2  He starts a project",
    screens: [
      { id: "2.1", name: "Projects", href: "/projects" },
      { id: "2.2", name: "New project", href: "/projects/new" },
      { id: "2.3", name: "Project home", href: "/projects/atlas" },
    ],
  },
  {
    title: "3  He brings the team in",
    screens: [
      { id: "3.1", name: "Invite people", href: "/projects/atlas/invite" },
      { id: "3.2", name: "Invites sent", href: "/projects/atlas" },
      { id: "3.3", name: "Join from a phone", href: "/join/atlas-7k2" },
    ],
  },
  {
    title: "4  Wednesday 9:00: the paper",
    screens: [
      { id: "4.1", name: "Morning head start", href: "/projects/atlas/paper" },
      { id: "4.2–4.3", name: "Drop thoughts, drag to people", href: "/projects/atlas/paper/plan" },
      { id: "4.4", name: "Paper sent", href: "/projects/atlas/paper/sent" },
    ],
  },
  {
    title: "5  During the day, he only watches",
    screens: [{ id: "5.1–5.2", name: "Live / Everyone's done", href: "/projects/atlas/live" }],
  },
  {
    title: "6  Meera's day, on her phone",
    screens: [
      { id: "6.1", name: "The paper arrives", href: "/me/atlas/notify" },
      { id: "6.2", name: "My projects", href: "/me" },
      { id: "6.3", name: "Papers", href: "/me/atlas" },
      { id: "6.4", name: "Today · tap to strike", href: "/me/atlas/today" },
      { id: "6.5", name: "Ask for more time", href: "/me/atlas/today/more-time" },
      { id: "6.6", name: "Paper done", href: "/me/atlas/done" },
      { id: "6.7", name: "Day ends, carry over", href: "/me/atlas/carry" },
    ],
  },
  ].map((row) => ({
    ...row,
    screens: row.screens.map((s) => ({ ...s, href: s.href.replace("atlas-7k2", code).replace("/atlas", `/${id}`) })),
  }));
}

export function DemoScreen() {
  return (
    <Hydrated>
      <Demo />
    </Hydrated>
  );
}

function Demo() {
  const router = useRouter();
  const { loadDemo, reset, projects } = useStore();
  const demo = projects.find((p) => p.isOwner && p.name === DEMO_PROJECT_NAME && p.leadName === DEMO_LEAD.name);
  const [busy, setBusy] = useState(false);
  const open = async (moment: "morning" | "afternoon") => {
    setBusy(true);
    const id = await loadDemo(moment);
    setBusy(false);
    if (id) router.push(moment === "morning" ? `/projects/${id}/paper` : `/projects/${id}/live`);
  };

  return (
    <div className="min-h-dvh bg-bg">
      <LeadHeader left={<Logo />} />
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-4 pt-8 pb-20 sm:px-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-[34px] font-semibold tracking-[-0.02em]">Demo: one team, one day</h1>
          <p className="max-w-[640px] text-mute">
            Yagnesh leads 4 people in Hyderabad, Berlin and Toronto. Load the story at a moment in the day, then open any screen. It&apos;s your own copy:
            loading a moment again replaces it, and this browser plays both Yagnesh (lead) and Meera (member).
          </p>
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              className={`${btn.primary} disabled:opacity-50`}
              disabled={busy}
              onClick={() => open("morning")}
            >
              Wednesday 8:52 am · plan the paper
            </button>
            <button
              type="button"
              className={`${btn.outline} disabled:opacity-50`}
              disabled={busy}
              onClick={() => open("afternoon")}
            >
              Wednesday afternoon · day underway
            </button>
            <button type="button" className={btn.ghost} disabled={busy} onClick={() => reset()}>
              Sign out and delete my data
            </button>
          </div>
          {!demo && <p className="text-sm text-amber">Load a moment first; the links below open your demo project.</p>}
        </div>

        {demo && rows(demo.id, demo.inviteCode).map((row) => (
          <section key={row.title} className="flex flex-col gap-3">
            <h2 className="font-hand text-[28px] font-bold">{row.title}</h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3">
              {row.screens.map((s) => (
                <li key={s.id}>
                  <Link href={s.href} className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-sheet p-4 hover:border-ink">
                    <span className="font-mono text-xs text-mute">{s.id}</span>
                    <span className="font-semibold">{s.name}</span>
                    <span className="truncate font-mono text-xs text-mute">{s.href}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}

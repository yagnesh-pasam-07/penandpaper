"use client";

import Link from "next/link";
import { useState } from "react";
import { COLUMN, DropHeader, type Me } from "./chrome";
import type { Resolution, RewindGroup } from "./resurface";
import { rewindLine } from "./resurface";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * The Sunday rewind: this week's thoughts, grouped by paper, open ones first.
 * Each open thought can be done (struck), kept, or let go, in one tap. Done
 * ones sit quietly underneath.
 */
export function RewindView({ me, from, to, groups: initial }: { me: Me; from: string; to: string; groups: RewindGroup[] }) {
  const [settled, setSettled] = useState<Record<string, Resolution>>({});

  async function choose(id: string, choice: Resolution) {
    setSettled((s) => ({ ...s, [id]: choice }));
    await fetch("/api/drop/resurface", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thoughtId: id, choice }) }).catch(() => {});
  }

  const button = "h-8 rounded-lg px-2.5 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";
  const label: Record<Resolution, string> = { act: "Done", keep: "Kept", let_go: "Let go", later: "Later" };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DropHeader me={me} title={<h1 className="font-hand text-[26px] leading-none font-bold">Rewind</h1>} />
      <main className={`${COLUMN} flex flex-1 flex-col gap-8 px-4 pt-8 pb-20 sm:px-8`}>
        <header className="flex flex-col gap-1">
          <h2 className="font-hand text-[44px] leading-none font-bold">Your week</h2>
          <p className="text-[15px] text-mute">
            {shortDate(from)} – {shortDate(to)} · {rewindLine(initial)}. Decide what each one becomes.
          </p>
        </header>

        {initial.length === 0 ? (
          <p className="text-mute">
            Nothing yet this week.{" "}
            <Link href="/drop" className="font-medium text-ink underline underline-offset-2">
              Open your paper
            </Link>{" "}
            and put a thought down.
          </p>
        ) : (
          initial.map((g) => (
            <section key={g.paperId} aria-label={g.paperName?.trim() || "Untitled paper"} className="flex flex-col gap-3">
              <h3 className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                <Link href={`/drop/${g.paperId}`} className="font-hand text-[28px] leading-none font-bold hover:underline">
                  {g.paperName?.trim() || "Untitled"}
                </Link>
                <span className="text-[13px] text-mute">
                  {g.open.length} open{g.done.length ? ` · ${g.done.length} done` : ""}
                </span>
              </h3>
              <ul className="flex flex-col gap-2">
                {g.open.map((t) => {
                  const done = settled[t.id];
                  return (
                    <li key={t.id} className={`flex flex-col gap-2 rounded-xl border border-line bg-sheet p-3 sm:flex-row sm:items-center ${done ? "opacity-55" : ""}`}>
                      <span className={`flex-1 font-note text-[18px] leading-snug break-words ${done === "act" ? "line-through decoration-red-text decoration-2" : ""}`}>
                        {t.text || (t.hasImage ? "A picture" : "")}
                      </span>
                      {done ? (
                        <span className="text-[13px] font-medium text-mute">{label[done]}</span>
                      ) : (
                        <span className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => void choose(t.id, "act")} className={`${button} bg-red text-on-red hover:brightness-95`}>
                            Do it
                          </button>
                          <button type="button" onClick={() => void choose(t.id, "keep")} className={`${button} border border-line hover:bg-soft`}>
                            Keep
                          </button>
                          <button type="button" onClick={() => void choose(t.id, "let_go")} className={`${button} text-mute hover:bg-soft hover:text-ink`}>
                            Let go
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
                {g.done.map((t) => (
                  <li key={t.id} className="px-3 font-note text-[16px] text-mute line-through decoration-red-text/60">
                    {t.text || "A picture"}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

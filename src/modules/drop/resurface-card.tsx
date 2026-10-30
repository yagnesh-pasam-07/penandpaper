"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ResurfaceCard as Card } from "./resurface-server";
import type { Resolution } from "./resurface";

/**
 * One old thought, back on the paper in the morning: "Yesterday you wrote …".
 * Do it (struck), Keep (comes back later), Let go (rests on its paper), or
 * Not now (tomorrow). Quiet by design: no streaks, no counts, one card, and it
 * can be switched off in Settings.
 */
export function ResurfaceCard() {
  const [card, setCard] = useState<Card | null>(null);
  const [said, setSaid] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/drop/resurface", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ card: Card | null }>) : null))
      .then((d) => live && d && setCard(d.card))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function choose(choice: Resolution) {
    if (!card) return;
    const words: Record<Resolution, string> = { act: "Struck. Nice.", keep: "Kept. It'll come back later.", let_go: "Let go. It stays on its paper.", later: "Tomorrow, then." };
    setSaid(words[choice]);
    setCard(null);
    await fetch("/api/drop/resurface", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thoughtId: card.id, choice }) }).catch(() => {});
    setTimeout(() => setSaid(""), 2600);
  }

  if (said)
    return (
      <p role="status" className="mx-auto w-full max-w-[560px] text-center text-[14px] text-mute">
        {said}
      </p>
    );
  if (!card) return null;

  const button = "h-9 rounded-lg px-3.5 text-[14px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";
  return (
    <section aria-label="A thought coming back" className="mx-auto flex w-full max-w-[560px] flex-col gap-3 rounded-2xl border border-line bg-sheet p-4 shadow-[0_14px_34px_-24px_var(--shadow)]">
      <span className="flex items-baseline justify-between gap-3 text-[13px] text-mute">
        <span>
          <span className="font-medium text-ink">{card.ago}</span> you wrote
        </span>
        <Link href={`/drop/${card.paperId}?note=${encodeURIComponent(card.id)}`} className="truncate hover:text-ink">
          on {card.paperName?.trim() || "your paper"}
        </Link>
      </span>
      <p className="font-note text-[20px] leading-snug break-words whitespace-pre-wrap">{card.text}</p>
      <span className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => void choose("act")} className={`${button} bg-red text-on-red hover:brightness-95`}>
          Do it
        </button>
        <button type="button" onClick={() => void choose("keep")} className={`${button} border border-line hover:bg-soft`}>
          Keep
        </button>
        <button type="button" onClick={() => void choose("let_go")} className={`${button} text-mute hover:bg-soft hover:text-ink`}>
          Let go
        </button>
        <button type="button" onClick={() => void choose("later")} className={`${button} ml-auto text-[13px] text-mute hover:bg-soft hover:text-ink`}>
          Not now
        </button>
      </span>
    </section>
  );
}

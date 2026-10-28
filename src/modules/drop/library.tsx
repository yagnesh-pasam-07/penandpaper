"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { call, COLUMN, DropHeader, useViewerTz, type Me } from "./chrome";
import { madeOn, MAX_PAPER_NAME, paperTitle, type PaperCardData, type PaperMeta } from "./logic";
import { SearchButton } from "./papers-ui";

const UNDO_MS = 6000;

/**
 * Every paper as a small card: a picture of its canvas, its name, the day it
 * was made and how many thoughts it holds. Newest first. Click to open (all of
 * them stay editable); rename, archive and delete live on each card.
 */
export function LibraryView({ me, papers: initial, archived }: { me: Me; papers: PaperCardData[]; archived: boolean }) {
  const router = useRouter();
  const tz = useViewerTz();
  const [papers, setPapers] = useState(initial);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const say = (next: { text: string; undo?: () => void } | null) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    if (next) timer.current = setTimeout(() => setToast(null), UNDO_MS);
  };
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const create = async () => {
    try {
      const made = await call<PaperMeta>("/api/drop/papers", { method: "POST", body: JSON.stringify({}) });
      router.push(`/drop/${made.id}`);
    } catch (e) {
      fail(e);
    }
  };

  const rename = async (p: PaperCardData, name: string) => {
    setRenaming(null);
    const next = name.trim() || null;
    if (next === (p.name?.trim() || null)) return;
    setPapers((all) => all.map((x) => (x.id === p.id ? { ...x, name: next } : x)));
    try {
      await call(`/api/drop/papers/${p.id}`, { method: "PATCH", body: JSON.stringify({ name: next }) });
    } catch (e) {
      setPapers((all) => all.map((x) => (x.id === p.id ? p : x)));
      fail(e);
    }
  };

  const archive = async (p: PaperCardData) => {
    const putAway = !p.archivedAt;
    setPapers((all) => all.filter((x) => x.id !== p.id));
    try {
      await call(`/api/drop/papers/${p.id}`, { method: "PATCH", body: JSON.stringify({ archived: putAway }) });
      say({
        text: putAway ? "Paper archived" : "Paper brought back",
        undo: () => {
          setPapers((all) => (all.some((x) => x.id === p.id) ? all : [p, ...all]));
          void call(`/api/drop/papers/${p.id}`, { method: "PATCH", body: JSON.stringify({ archived: !putAway }) }).catch(fail);
          say(null);
        },
      });
    } catch (e) {
      setPapers((all) => [p, ...all]);
      fail(e);
    }
  };

  const remove = async (p: PaperCardData) => {
    setPapers((all) => all.filter((x) => x.id !== p.id));
    try {
      await call(`/api/drop/papers/${p.id}`, { method: "DELETE" });
      say({
        text: "Paper deleted",
        undo: () => {
          setPapers((all) => (all.some((x) => x.id === p.id) ? all : [p, ...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
          void call(`/api/drop/papers/${p.id}`, { method: "PATCH", body: JSON.stringify({ deleted: false }) }).catch(fail);
          say(null);
        },
      });
    } catch (e) {
      setPapers((all) => [p, ...all]);
      fail(e);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DropHeader
        me={me}
        title={<h1 className="font-hand text-[26px] leading-none font-bold">Library</h1>}
        right={
          <>
            <SearchButton />
            <Link href="/drop" className="rounded-lg px-2.5 py-2 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
              Back to canvas
            </Link>
          </>
        }
      />
      <main className={`${COLUMN} flex flex-1 flex-col gap-6 px-4 pt-6 pb-24 sm:px-8`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute">
            {papers.length} {archived ? "archived" : ""} {papers.length === 1 ? "paper" : "papers"}, newest first
          </p>
          <span className="flex items-center gap-2">
            <Link
              href={archived ? "/drop/library" : "/drop/library?archived=1"}
              aria-pressed={archived}
              className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-soft ${archived ? "bg-soft text-ink" : "text-mute"}`}
            >
              {archived ? "Archived ✓" : "Archived"}
            </Link>
            {!archived && (
              <button type="button" onClick={() => void create()} className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-bg">
                <PlusIcon size={14} />
                New paper
              </button>
            )}
          </span>
        </div>

        {papers.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-line p-8 text-center text-mute">
            {archived ? "Nothing is archived." : "No papers yet. Make one with New paper."}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {papers.map((p) => (
              <li key={p.id} className="group relative flex flex-col gap-2 rounded-2xl border border-line bg-sheet p-2.5">
                <Link href={`/drop/${p.id}`} aria-label={`Open ${paperTitle(p)}`} className="canvas-surface relative block aspect-[4/3] overflow-hidden rounded-xl border border-line">
                  {p.notes.map((n) => (
                    <span
                      key={n.id}
                      style={{ left: `${n.left}%`, top: `${n.top}%` }}
                      className={`absolute max-w-[42%] truncate font-note text-[11px] leading-none whitespace-nowrap ${n.done ? "text-mute line-through decoration-red-text" : "text-ink"}`}
                    >
                      {n.text}
                    </span>
                  ))}
                  {p.notes.length === 0 && <span className="absolute inset-0 flex items-center justify-center text-[12px] text-mute">Blank</span>}
                </Link>
                <div className="flex items-start gap-2 px-1 pb-1">
                  <span className="flex min-w-0 flex-1 flex-col">
                    {renaming === p.id ? (
                      <input
                        autoFocus
                        defaultValue={p.name ?? ""}
                        maxLength={MAX_PAPER_NAME}
                        aria-label="Paper name"
                        placeholder="Untitled"
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => void rename(p, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          else if (e.key === "Escape") {
                            e.currentTarget.value = p.name ?? "";
                            e.currentTarget.blur();
                          }
                        }}
                        className="h-8 rounded-lg border border-line bg-bg px-2 text-[15px] font-semibold outline-none focus:border-red-text"
                      />
                    ) : (
                      <span className={`truncate text-[15px] font-semibold ${p.name ? "" : "text-mute"}`}>{paperTitle(p)}</span>
                    )}
                    <span className="text-[12px] text-mute">
                      {madeOn(p.createdAt, tz)} · {p.count} {p.count === 1 ? "thought" : "thoughts"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={() => setRenaming(p.id)} className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-mute hover:bg-soft hover:text-ink">
                      Rename
                    </button>
                    <button type="button" onClick={() => void archive(p)} className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-mute hover:bg-soft hover:text-ink">
                      {p.archivedAt ? "Bring back" : "Archive"}
                    </button>
                    <button type="button" onClick={() => void remove(p)} className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-red-text hover:bg-red-soft">
                      Delete
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {(toast || error) && (
        <div role={error ? "alert" : "status"} className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg">
          <span className="flex-1">{error || toast?.text}</span>
          {!error && toast?.undo ? (
            <button type="button" onClick={toast.undo} className="font-semibold underline-offset-2 hover:underline">
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError("");
                setToast(null);
              }}
              className="font-semibold"
            >
              OK
            </button>
          )}
        </div>
      )}
    </div>
  );
}

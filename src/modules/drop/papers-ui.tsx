"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CaretIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { call, useViewerTz } from "./chrome";
import { madeOn, MAX_PAPER_NAME, MIN_SEARCH, paperTitle, snippetAround, splitMatch, type PaperMeta, type SearchHit } from "./logic";

/** Where a deleted paper waits for its Undo, across the move to the next paper. */
export const UNDO_PAPER_KEY = "pp-undo-paper";

/** Closes whatever is open on Esc or a press anywhere outside `ref`. */
function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [ref, open, close]);
}

type Head = { id: string; name: string | null; createdAt: string; archivedAt: string | null };

const item = "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-soft focus-visible:bg-soft";

/**
 * The header's paper controls: the open paper's name and date (a menu to switch
 * papers and to rename, archive or delete this one) and a + that makes a new one.
 * On a phone the menu is a sheet at the bottom of the screen.
 */
export function PaperBar({ paper, papers }: { paper: Head; papers: PaperMeta[] }) {
  const router = useRouter();
  const tz = useViewerTz();
  const [menu, setMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLSpanElement>(null);
  const newRef = useRef<HTMLSpanElement>(null);
  useDismiss(menuRef, menu, () => setMenu(false));
  useDismiss(newRef, creating, () => setCreating(false));

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const create = async (name: string) => {
    setBusy(true);
    try {
      const made = await call<PaperMeta>("/api/drop/papers", { method: "POST", body: JSON.stringify({ name: name.trim() || null }) });
      setCreating(false);
      router.push(`/drop/${made.id}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const rename = async (name: string) => {
    setRenaming(false);
    if ((name.trim() || null) === (paper.name?.trim() || null)) return;
    try {
      await call(`/api/drop/papers/${paper.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() || null }) });
      router.refresh();
    } catch (e) {
      fail(e);
    }
  };

  const archive = async () => {
    setMenu(false);
    try {
      await call(`/api/drop/papers/${paper.id}`, { method: "PATCH", body: JSON.stringify({ archived: !paper.archivedAt }) });
      // Putting it away moves on to the paper touched last; bringing it back stays.
      if (paper.archivedAt) router.refresh();
      else router.push("/drop");
    } catch (e) {
      fail(e);
    }
  };

  const remove = async () => {
    setMenu(false);
    try {
      await call(`/api/drop/papers/${paper.id}`, { method: "DELETE" });
      try {
        sessionStorage.setItem(UNDO_PAPER_KEY, JSON.stringify({ id: paper.id, title: paperTitle(paper) }));
      } catch {}
      router.push("/drop");
    } catch (e) {
      fail(e);
    }
  };

  return (
    <>
      <span ref={menuRef} className="relative min-w-0">
        {renaming ? (
          <input
            autoFocus
            defaultValue={paper.name ?? ""}
            maxLength={MAX_PAPER_NAME}
            aria-label="Paper name"
            placeholder="Untitled"
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => void rename(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                e.stopPropagation();
                e.currentTarget.value = paper.name ?? "";
                e.currentTarget.blur();
              }
            }}
            className="h-9 w-[min(52vw,16rem)] rounded-lg bg-sheet/70 px-2 font-hand text-[24px] leading-none font-bold outline-none placeholder:font-normal placeholder:text-mute focus:bg-sheet"
          />
        ) : (
          <button
            type="button"
            onClick={() => setMenu((o) => !o)}
            onDoubleClick={() => {
              setMenu(false);
              setRenaming(true);
            }}
            aria-haspopup="menu"
            aria-expanded={menu}
            title="Switch paper (double-click to rename)"
            className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-soft"
          >
            <span className={`truncate font-hand text-[26px] leading-none font-bold ${paper.name ? "" : "text-mute"}`}>{paperTitle(paper)}</span>
            <span className="text-mute">
              <CaretIcon />
            </span>
          </button>
        )}
        {menu && (
          <>
            <span aria-hidden="true" onClick={() => setMenu(false)} className="scrim-bg fixed inset-0 z-40 sm:hidden" />
            <div
              role="menu"
              aria-label="Papers"
              className="fixed inset-x-2 bottom-2 z-50 flex max-h-[70dvh] flex-col gap-1 rounded-2xl border border-line bg-sheet p-2 shadow-[0_18px_40px_-20px_var(--shadow)] sm:absolute sm:inset-x-auto sm:top-full sm:bottom-auto sm:left-0 sm:mt-2 sm:w-80"
            >
              <ul className="flex flex-col overflow-y-auto">
                {papers.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/drop/${p.id}`}
                      role="menuitem"
                      aria-current={p.id === paper.id ? "page" : undefined}
                      onClick={() => setMenu(false)}
                      className={`${item} ${p.id === paper.id ? "bg-soft font-semibold" : ""}`}
                    >
                      <span className={`min-w-0 flex-1 truncate ${p.name ? "" : "text-mute"}`}>{paperTitle(p)}</span>
                      <span className="shrink-0 text-[12px] text-mute">
                        {madeOn(p.createdAt, tz)} · {p.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col border-t border-line pt-1">
                <Link href="/drop/library" role="menuitem" onClick={() => setMenu(false)} className={item}>
                  Library
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    setRenaming(true);
                  }}
                  className={item}
                >
                  Rename this paper
                </button>
                <button type="button" role="menuitem" onClick={() => void archive()} className={item}>
                  {paper.archivedAt ? "Bring this paper back" : "Archive this paper"}
                </button>
                <button type="button" role="menuitem" onClick={() => void remove()} className={`${item} text-red-text hover:bg-red-soft`}>
                  Delete this paper
                </button>
              </div>
            </div>
          </>
        )}
      </span>
      <span className="truncate text-[13px] text-mute max-sm:hidden">{madeOn(paper.createdAt, tz)}</span>
      <span ref={newRef} className="relative">
        <button
          type="button"
          onClick={() => setCreating((o) => !o)}
          aria-label="New paper"
          aria-expanded={creating}
          title="New paper"
          className="flex size-8 items-center justify-center self-center rounded-full border border-line bg-sheet text-mute hover:bg-soft hover:text-ink"
        >
          <PlusIcon size={14} />
        </button>
        {creating && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void create(new FormData(e.currentTarget).get("name")?.toString() ?? "");
            }}
            className="absolute top-full left-0 z-50 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-2xl border border-line bg-sheet p-3 shadow-[0_18px_40px_-20px_var(--shadow)]"
          >
            <label htmlFor="new-paper-name" className="text-[13px] font-medium text-mute">
              New paper
            </label>
            <input
              id="new-paper-name"
              name="name"
              autoFocus
              maxLength={MAX_PAPER_NAME}
              placeholder="Name it (or don't)"
              className="h-10 rounded-lg border border-line bg-bg px-3 text-[15px] outline-none focus:border-red-text"
            />
            <span className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-mute">Made {madeOn(new Date().toISOString(), tz)}</span>
              <button type="submit" disabled={busy} className="h-9 rounded-lg bg-ink px-3.5 text-sm font-semibold text-bg disabled:opacity-50">
                Create
              </button>
            </span>
          </form>
        )}
      </span>
      {error && (
        <span role="alert" className="truncate text-[13px] text-red-text">
          {error}
        </span>
      )}
    </>
  );
}

/** The search button; Ctrl/⌘ K opens it from anywhere on the page. */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search every paper"
        title="Search every paper (Ctrl/⌘ K)"
        className="flex size-10 items-center justify-center rounded-full text-mute hover:bg-soft hover:text-ink"
      >
        <SearchIcon size={18} />
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** Search across every paper: type, pick a result, land on that paper with the note pulsing. */
function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const tz = useViewerTz();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [at, setAt] = useState(0);
  const [error, setError] = useState("");
  const term = q.replace(/\s+/g, " ").trim();

  useEffect(() => {
    if (term.length < MIN_SEARCH) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const found = await call<SearchHit[]>(`/api/drop/search?q=${encodeURIComponent(term)}`);
        if (!current) return;
        setHits(found);
        setAt(0);
        setError("");
      } catch (e) {
        if (current) setError(e instanceof Error ? e.message : String(e));
      }
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [term]);

  const results = term.length >= MIN_SEARCH ? hits : null;
  const open = (hit: SearchHit) => {
    onClose();
    router.push(`/drop/${hit.paperId}?note=${hit.thoughtId}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search every paper"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "ArrowDown" && results?.length) {
          e.preventDefault();
          setAt((i) => Math.min(results.length - 1, i + 1));
        } else if (e.key === "ArrowUp" && results?.length) {
          e.preventDefault();
          setAt((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter" && results?.[at]) {
          e.preventDefault();
          open(results[at]);
        }
      }}
      className="scrim-bg fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12dvh]"
    >
      <div className="flex max-h-[70dvh] w-full max-w-xl flex-col gap-2 rounded-2xl border border-line bg-sheet p-3 shadow-[0_30px_60px_-30px_var(--shadow)]">
        <span className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3">
          <span className="text-mute">
            <SearchIcon />
          </span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search every paper"
            aria-label="Search every paper"
            className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-mute"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="flex size-8 items-center justify-center rounded-full text-mute hover:bg-soft">
            <CloseIcon size={12} />
          </button>
        </span>
        {error ? (
          <p role="alert" className="px-2 py-3 text-sm text-red-text">
            {error}
          </p>
        ) : term.length < MIN_SEARCH ? (
          <p className="px-2 py-3 text-sm text-mute">Type at least {MIN_SEARCH} letters to find a thought on any paper.</p>
        ) : results === null ? (
          <p className="px-2 py-3 text-sm text-mute">Searching…</p>
        ) : results.length === 0 ? (
          <p className="px-2 py-3 text-sm text-mute">Nothing on any paper says &ldquo;{term}&rdquo;.</p>
        ) : (
          <ul role="listbox" aria-label="Results" className="flex flex-col overflow-y-auto">
            {results.map((hit, i) => (
              <li key={hit.thoughtId} role="option" aria-selected={i === at}>
                <button
                  type="button"
                  onClick={() => open(hit)}
                  onMouseEnter={() => setAt(i)}
                  className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left ${i === at ? "bg-soft" : ""}`}
                >
                  <span className="font-note text-[17px] leading-snug">
                    {splitMatch(snippetAround(hit.text, term), term).map((part, j) =>
                      part.match ? (
                        <mark key={j} className="rounded-sm bg-red-soft px-0.5 text-ink">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={j}>{part.text}</span>
                      ),
                    )}
                  </span>
                  <span className="text-[12px] text-mute">
                    {paperTitle({ name: hit.paperName })} · {madeOn(hit.paperCreatedAt, tz)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

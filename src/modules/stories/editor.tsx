"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type ClipboardEvent, type KeyboardEvent } from "react";
import { publish, remove, save, translate } from "@/app/studio/stories/actions";
import { newKey, toBlocks, toMarkdown, type EditBlock } from "./blocks";
import { CATEGORIES, CATEGORY_LABEL, clock, readLabel, type Category, type StoryState } from "./logic";
import { uploadAudio, uploadImage } from "./upload";

export type EditorStory = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  hook: string;
  body: string;
  category: Category;
  coverId: string | null;
  coverCaption: string;
  audioId: string | null;
  audioDurationSec: number | null;
  originalUrl: string | null;
  shareText: string;
  shareMediaId: string | null;
  personName: string;
  personPlace: string;
  personPhotoId: string | null;
  personConsent: boolean;
  series: string;
  sources: string;
  language: string;
  translationOf: string | null;
  readingMinutes: number;
  state: StoryState;
  publishAt: string | null;
};

const MEDIA = "/studio/stories/media/";

type TextBlock = Extract<EditBlock, { text: string }>;

/** A textarea that grows with its text, so the page reads like the page it makes. */
function Grow({ value, onChange, className, placeholder, onKeyDown, onPaste, autoFocus, label, inputRef }: { value: string; onChange: (v: string) => void; className: string; placeholder?: string; onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void; onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void; autoFocus?: boolean; label: string; inputRef?: (el: HTMLTextAreaElement | null) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        inputRef?.(el);
      }}
      aria-label={label}
      rows={1}
      value={value}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={`block w-full overflow-hidden ${className}`}
    />
  );
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

/** The local "YYYY-MM-DDTHH:MM" for a datetime-local input: next Sunday at 9 AM, the default release. */
function nextSundayNine(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * The writer's editor. No form: the title, subtitle and story are typed
 * straight onto a page set in the reading font, at the reading width, so what
 * you write is what they read. Enter starts a new paragraph; a "+" in the
 * margin adds a picture, a heading, a quote or a break; Markdown shortcuts
 * work too ("## ", "> ", "---"). It saves itself as you write.
 */
export function StoryEditor({ initial, focusBlock = null }: { initial: EditorStory; focusBlock?: number | null }) {
  const [s, setS] = useState(initial);
  const [blocks, setBlocks] = useState<EditBlock[]>(() => toBlocks(initial.body));
  // Arriving from Studio's "where readers stop": bring that paragraph into view and mark it for a moment.
  const [marked, setMarked] = useState<number | null>(focusBlock);
  useEffect(() => {
    if (focusBlock === null) return;
    const el = document.querySelector(`[data-block="${focusBlock}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setMarked(null), 4000);
    return () => clearTimeout(t);
  }, [focusBlock]);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState(false);
  const [schedule, setSchedule] = useState(nextSundayNine);
  const [, start] = useTransition();
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const focusNext = useRef<{ key: string; at: "start" | "end" } | null>(null);
  const dirty = useRef<Partial<EditorStory> & { body?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const patch = dirty.current;
    dirty.current = {};
    if (!Object.keys(patch).length) return;
    setSaved("saving");
    const res = await save(s.id, {
      title: patch.title,
      subtitle: patch.subtitle,
      hook: patch.hook,
      body: patch.body,
      category: patch.category,
      coverMediaId: patch.coverId,
      coverCaption: patch.coverCaption,
      audioMediaId: patch.audioId,
      audioDurationSec: patch.audioDurationSec,
      originalUrl: patch.originalUrl === "" ? null : patch.originalUrl,
      shareText: patch.shareText,
      shareMediaId: patch.shareMediaId,
      personName: patch.personName,
      personPlace: patch.personPlace,
      personPhotoId: patch.personPhotoId,
      personConsent: patch.personConsent,
      series: patch.series,
      sources: patch.sources,
      language: patch.language as "en" | "te" | undefined,
    }).catch(() => ({ error: "Not saved. Check your connection." }));
    if ("error" in res) {
      setSaved("error");
      setError(res.error);
      dirty.current = { ...patch, ...dirty.current };
      return;
    }
    setSaved("saved");
    setError("");
    setS((cur) => ({ ...cur, slug: res.slug, readingMinutes: res.readingMinutes }));
  }, [s.id]);

  const queue = useCallback(
    (patch: Partial<EditorStory>) => {
      dirty.current = { ...dirty.current, ...patch };
      setSaved("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 900);
    },
    [flush],
  );

  // Never lose words: save on leaving, and warn while a save is pending.
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (Object.keys(dirty.current).length) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [flush]);

  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    const el = refs.current.get(f.key);
    if (!el) return;
    el.focus();
    const at = f.at === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
  }, [blocks]);

  const field = (k: "title" | "subtitle" | "hook" | "coverCaption" | "originalUrl" | "shareText" | "personName" | "personPlace" | "series" | "sources", v: string) => {
    setS((cur) => ({ ...cur, [k]: v }));
    queue({ [k]: v });
  };

  const setBody = (next: EditBlock[]) => {
    setBlocks(next);
    queue({ body: toMarkdown(next) });
  };

  const update = (key: string, patch: Partial<EditBlock>) => setBody(blocks.map((b) => (b.key === key ? ({ ...b, ...patch } as EditBlock) : b)));

  const insertAfter = (key: string | null, nb: EditBlock, focus = true) => {
    const i = key ? blocks.findIndex((b) => b.key === key) : blocks.length - 1;
    const next = [...blocks.slice(0, i + 1), nb, ...blocks.slice(i + 1)];
    // Something to type into after a picture or a break.
    if ((nb.t === "img" || nb.t === "hr") && !next[i + 2]) next.push({ key: newKey(), t: "p", text: "" });
    if (focus && nb.t !== "img" && nb.t !== "hr") focusNext.current = { key: nb.key, at: "start" };
    setBody(next);
  };

  const onKey = (b: TextBlock, e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const i = blocks.findIndex((x) => x.key === b.key);
    if (e.key === "Enter" && !e.shiftKey) {
      // Enter: a new paragraph, splitting the text at the cursor.
      e.preventDefault();
      const head = el.value.slice(0, el.selectionStart);
      const tail = el.value.slice(el.selectionEnd);
      const nb: EditBlock = { key: newKey(), t: "p", text: tail };
      focusNext.current = { key: nb.key, at: "start" };
      setBody([...blocks.slice(0, i), { ...b, text: head }, nb, ...blocks.slice(i + 1)]);
      return;
    }
    if (e.key === " " && b.t === "p" && el.selectionStart === el.value.length) {
      // Markdown shortcuts at the start of an empty paragraph.
      const v = el.value;
      if (v === "##" || v === "#") {
        e.preventDefault();
        update(b.key, { t: "h", text: "" });
        return;
      }
      if (v === ">") {
        e.preventDefault();
        update(b.key, { t: "quote", text: "" });
        return;
      }
    }
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (b.t !== "p") {
        // First, a heading or quote becomes a paragraph again.
        e.preventDefault();
        update(b.key, { t: "p" });
        return;
      }
      const prev = blocks[i - 1];
      if (prev && (prev.t === "p" || prev.t === "h" || prev.t === "quote")) {
        // Join with the paragraph above.
        e.preventDefault();
        focusNext.current = { key: prev.key, at: "end" };
        const joined: TextBlock = { ...prev, text: prev.text + b.text };
        setBody([...blocks.slice(0, i - 1), joined, ...blocks.slice(i + 1)]);
        requestAnimationFrame(() => {
          const pel = refs.current.get(prev.key);
          if (pel) pel.setSelectionRange(prev.text.length, prev.text.length);
        });
        return;
      }
      if (prev && !b.text) {
        e.preventDefault();
        setBody([...blocks.slice(0, i), ...blocks.slice(i + 1)]);
      }
    }
    if (e.key === "ArrowUp" && el.selectionStart === 0) {
      const prev = [...blocks.slice(0, i)].reverse().find((x) => x.t === "p" || x.t === "h" || x.t === "quote");
      if (prev) {
        e.preventDefault();
        refs.current.get(prev.key)?.focus();
      }
    }
    if (e.key === "ArrowDown" && el.selectionEnd === el.value.length) {
      const next = blocks.slice(i + 1).find((x) => x.t === "p" || x.t === "h" || x.t === "quote");
      if (next) {
        e.preventDefault();
        const nel = refs.current.get(next.key);
        nel?.focus();
        nel?.setSelectionRange(0, 0);
      }
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "i")) {
      // ⌘B / ⌘I wrap the selection in ** or *.
      e.preventDefault();
      const mark = e.key === "b" ? "**" : "*";
      const a = el.selectionStart;
      const z = el.selectionEnd;
      const text = `${el.value.slice(0, a)}${mark}${el.value.slice(a, z)}${mark}${el.value.slice(z)}`;
      update(b.key, { text });
      requestAnimationFrame(() => el.setSelectionRange(a + mark.length, z + mark.length));
    }
  };

  /** Pasting several paragraphs makes several blocks; a pasted picture is uploaded. */
  const onPaste = (b: TextBlock, e: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      void addPicture(file, b.key);
      return;
    }
    const text = e.clipboardData.getData("text/plain");
    if (!/\n\s*\n/.test(text)) return;
    e.preventDefault();
    const el = e.currentTarget;
    const head = el.value.slice(0, el.selectionStart);
    const tail = el.value.slice(el.selectionEnd);
    const pasted = toBlocks(text);
    const i = blocks.findIndex((x) => x.key === b.key);
    const first = pasted[0];
    const lead: TextBlock = { ...b, text: head + (first.t === "p" ? first.text : "") };
    const merged: EditBlock[] = [lead, ...(first.t === "p" ? pasted.slice(1) : pasted)];
    const last = merged[merged.length - 1];
    if (last.t === "p" || last.t === "h" || last.t === "quote") merged[merged.length - 1] = { ...last, text: last.text + tail };
    else if (tail) merged.push({ key: newKey(), t: "p", text: tail });
    focusNext.current = { key: merged[merged.length - 1].key, at: "end" };
    setBody([...blocks.slice(0, i), ...merged, ...blocks.slice(i + 1)]);
  };

  const addPicture = async (file: File, after: string | null) => {
    setBusy("Adding the picture…");
    try {
      const { id } = await uploadImage(s.id, file);
      insertAfter(after, { key: newKey(), t: "img", id, caption: "", credit: "" }, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture couldn't be added.");
    } finally {
      setBusy("");
    }
  };

  const setCover = async (file: File) => {
    setBusy("Adding the cover…");
    try {
      const { id } = await uploadImage(s.id, file);
      setS((cur) => ({ ...cur, coverId: id }));
      queue({ coverId: id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture couldn't be added.");
    } finally {
      setBusy("");
    }
  };

  const setPersonPhoto = async (file: File) => {
    setBusy("Adding their photo…");
    try {
      const { id } = await uploadImage(s.id, file);
      setS((cur) => ({ ...cur, personPhotoId: id }));
      queue({ personPhotoId: id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture couldn't be added.");
    } finally {
      setBusy("");
    }
  };

  const setSharePic = async (file: File) => {
    setBusy("Adding the WhatsApp picture…");
    try {
      const { id } = await uploadImage(s.id, file);
      setS((cur) => ({ ...cur, shareMediaId: id }));
      queue({ shareMediaId: id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture couldn't be added.");
    } finally {
      setBusy("");
    }
  };

  const setAudio = async (file: File) => {
    setBusy("Uploading your recording… 0%");
    try {
      const { id, duration } = await uploadAudio(s.id, file, (p) => setBusy(`Uploading your recording… ${Math.round(p * 100)}%`));
      setS((cur) => ({ ...cur, audioId: id, audioDurationSec: duration }));
      queue({ audioId: id, audioDurationSec: duration });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That recording couldn't be added.");
    } finally {
      setBusy("");
    }
  };

  const doPublish = (whenAt: "now" | "unpublish" | string) =>
    start(async () => {
      await flush();
      const res = await publish(s.id, whenAt);
      if ("error" in res) return setError(res.error);
      const at = whenAt === "now" ? new Date().toISOString() : whenAt === "unpublish" ? null : new Date(whenAt).toISOString();
      setS((cur) => ({ ...cur, state: whenAt === "unpublish" ? "draft" : whenAt === "now" ? "published" : "scheduled", publishAt: at ?? cur.publishAt }));
      setPanel(false);
    });

  const words = toMarkdown(blocks).split(/\s+/).filter(Boolean).length;
  const stateLine = s.state === "published" ? `Published ${when(s.publishAt)}` : s.state === "scheduled" ? `Scheduled for ${when(s.publishAt)}` : "Draft";

  return (
    <div className="story-edit flex min-h-dvh flex-col bg-bg">
      {/* The bar: back, where it stands, save state, Preview, Publish. */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 font-sans backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-3 px-4 sm:px-8">
          <Link href="/studio/stories" className="text-[14px] text-mute hover:text-ink">
            ← Stories
          </Link>
          <span className="flex items-center gap-2 text-[13px] text-mute">
            <span className={`size-2 rounded-full ${s.state === "published" ? "bg-green" : s.state === "scheduled" ? "bg-amber" : "bg-line"}`} aria-hidden="true" />
            <span className="max-sm:hidden">{stateLine}</span>
            <span aria-live="polite" className="text-mute/80">
              · {saved === "saving" ? "Saving…" : saved === "error" ? "Not saved" : "Saved"}
            </span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Link href={`/studio/stories/${s.id}/preview`} target="_blank" onClick={() => void flush()} className="flex h-9 items-center rounded-full px-4 text-[14px] font-medium text-ink hover:bg-soft">
              Preview
            </Link>
            <button type="button" onClick={() => setPanel((p) => !p)} aria-expanded={panel} className="flex h-9 items-center rounded-full bg-brand-green px-4 text-[14px] font-semibold text-on-red hover:brightness-105">
              {s.state === "draft" ? "Publish…" : "Published ▾"}
            </button>
          </span>
        </div>
        {(error || busy) && (
          <p role="status" className={`border-t border-line px-4 py-2 text-center text-[13px] ${error ? "text-red-text" : "text-mute"}`}>
            {error || busy}
            {error && (
              <button type="button" className="ml-3 underline" onClick={() => setError("")}>
                OK
              </button>
            )}
          </p>
        )}
      </header>

      {panel && (
        <PublishPanel
          s={s}
          words={words}
          schedule={schedule}
          setSchedule={setSchedule}
          onPublish={doPublish}
          onClose={() => setPanel(false)}
          onField={field}
          onCategory={(c) => {
            setS((cur) => ({ ...cur, category: c }));
            queue({ category: c });
          }}
          onCover={(f) => void setCover(f)}
          onRemoveCover={() => {
            setS((cur) => ({ ...cur, coverId: null }));
            queue({ coverId: null });
          }}
          onAudio={(f) => void setAudio(f)}
          onRemoveAudio={() => {
            setS((cur) => ({ ...cur, audioId: null, audioDurationSec: null }));
            queue({ audioId: null, audioDurationSec: null });
          }}
          onSharePic={(f) => void setSharePic(f)}
          onSet={(patch) => {
            setS((cur) => ({ ...cur, ...patch }));
            queue(patch);
          }}
          onPersonPhoto={(f) => void setPersonPhoto(f)}
          onRemoveSharePic={() => {
            setS((cur) => ({ ...cur, shareMediaId: null }));
            queue({ shareMediaId: null });
          }}
        />
      )}

      <main className="story-serif mx-auto flex w-full max-w-[728px] flex-col px-6 pt-10 pb-40 sm:pt-14">
        <p className="pb-4 font-sans text-[13px] font-semibold tracking-[0.08em] text-red-text uppercase">{CATEGORY_LABEL[s.category]}</p>
        <Grow label="Title" value={s.title} onChange={(v) => field("title", v.replace(/\n/g, " "))} autoFocus={!s.title} placeholder="Title" className="text-[38px] leading-[1.08] font-medium tracking-[-0.02em] text-ink sm:text-[52px]" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), refs.current.get("subtitle")?.focus())} />
        <Grow
          label="Subtitle"
          inputRef={(el) => (el ? refs.current.set("subtitle", el) : refs.current.delete("subtitle"))}
          value={s.subtitle}
          onChange={(v) => field("subtitle", v.replace(/\n/g, " "))}
          placeholder="A subtitle, if it needs one"
          className="mt-4 text-[21px] leading-[1.45] text-mute sm:text-[23px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const first = blocks.find((b) => b.t !== "img" && b.t !== "hr");
              if (first) refs.current.get(first.key)?.focus();
            }
          }}
        />

        {/* The cover, as it will sit under the byline. */}
        <div className="mt-8">
          {s.coverId ? (
            <figure className="group relative flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- the writer's own upload, resized by our route */}
              <img src={`${MEDIA}${s.coverId}?w=960`} alt="" className="w-full rounded-md bg-soft" />
              <input value={s.coverCaption} onChange={(e) => field("coverCaption", e.target.value)} placeholder="A caption for the cover (optional)" aria-label="Cover caption" className="px-1 text-center font-sans text-[14px] text-mute" />
            </figure>
          ) : (
            <FileButton accept="image/*" onFile={(f) => void setCover(f)} className="flex h-28 w-full items-center justify-center rounded-md border border-dashed border-line font-sans text-[14px] text-mute hover:border-mute hover:text-ink">
              + Add a cover picture
            </FileButton>
          )}
        </div>

        <div className="mt-10 flex flex-col gap-8 text-[19px] leading-[1.6] tracking-[-0.003em] text-ink/90 sm:text-[20px]">
          {blocks.map((b, i) => (
            <div key={b.key} data-block={i} className={`group relative rounded-md transition-colors duration-700 ${marked === i ? "bg-red-soft/60 outline-2 outline-offset-8 outline-red-text/40" : ""}`}>
              <Margin
                onPicture={(f) => void addPicture(f, b.key)}
                onAdd={(t) => insertAfter(b.key, t === "hr" ? { key: newKey(), t: "hr" } : { key: newKey(), t, text: "" })}
                onRemove={blocks.length > 1 ? () => setBody(blocks.filter((x) => x.key !== b.key)) : undefined}
              />
              {b.t === "hr" ? (
                <div role="separator" className="flex justify-center py-4 text-[20px] tracking-[0.6em] text-mute">
                  · · ·
                </div>
              ) : b.t === "img" ? (
                <figure className="flex flex-col gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the writer's own upload, resized by our route */}
                  <img src={`${MEDIA}${b.id}?w=960`} alt={b.caption} className="w-full rounded-md bg-soft" />
                  <input value={b.caption} onChange={(e) => update(b.key, { caption: e.target.value })} placeholder="Caption: what are we looking at?" aria-label="Picture caption" className="px-1 text-center font-sans text-[14px] text-mute" />
                  <input value={b.credit} onChange={(e) => update(b.key, { credit: e.target.value })} placeholder="Artist (optional)" aria-label="Artist credit" className="px-1 text-center font-sans text-[12px] tracking-[0.04em] text-mute uppercase" />
                </figure>
              ) : (
                <Grow
                  label={b.t === "h" ? "Heading" : b.t === "quote" ? "Quote" : "Paragraph"}
                  inputRef={(el) => (el ? refs.current.set(b.key, el) : refs.current.delete(b.key))}
                  value={b.text}
                  onChange={(v) => update(b.key, { text: v })}
                  onKeyDown={(e) => onKey(b, e)}
                  onPaste={(e) => onPaste(b, e)}
                  placeholder={i === 0 && blocks.length === 1 ? "Tell your story…" : b.t === "h" ? "Heading" : b.t === "quote" ? "A line worth pausing on" : ""}
                  className={
                    b.t === "h"
                      ? "pt-6 font-sans text-[22px] leading-snug font-semibold tracking-[-0.01em] text-ink sm:text-[24px]"
                      : b.t === "quote"
                        ? "border-l-[3px] border-red pl-5 text-[23px] leading-[1.5] text-ink italic sm:pl-6 sm:text-[26px]"
                        : ""
                  }
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-16 font-sans text-[13px] text-mute">
          {words} words · {readLabel(s.readingMinutes)} · Enter for a new paragraph, ⌘B bold, ⌘I italic, “## ” heading, “&gt; ” quote. The ＋ in the margin adds a picture.
        </p>
      </main>
    </div>
  );
}

function FileButton({ accept, onFile, className, children }: { accept: string; onFile: (f: File) => void; className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className={className}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** The ＋ beside a block: add a picture, heading, quote or break after it (or remove it). Medium-style, in the left margin. */
function Margin({ onPicture, onAdd, onRemove }: { onPicture: (f: File) => void; onAdd: (t: "p" | "h" | "quote" | "hr") => void; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  const item = "flex h-9 items-center rounded-full border border-line bg-sheet px-3 text-[13px] text-ink hover:bg-soft";
  return (
    <div className="absolute top-1 -left-12 z-10 flex items-center gap-1.5 font-sans opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:static max-sm:mb-1 max-sm:hidden max-sm:group-focus-within:flex">
      <button type="button" aria-label="Add after this" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex size-9 items-center justify-center rounded-full border border-line bg-sheet text-[18px] text-mute hover:text-ink ${open ? "rotate-45" : ""} transition-transform`}>
        +
      </button>
      {open && (
        <div className="flex gap-1.5" onClick={() => setOpen(false)}>
          <FileButton accept="image/*" onFile={onPicture} className={item}>
            Picture
          </FileButton>
          <button type="button" className={item} onClick={() => onAdd("h")}>
            Heading
          </button>
          <button type="button" className={item} onClick={() => onAdd("quote")}>
            Quote
          </button>
          <button type="button" className={item} onClick={() => onAdd("hr")}>
            Break
          </button>
          {onRemove && (
            <button type="button" className={`${item} text-red-text`} onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Publish: the few things a reader sees outside the story, then now or later. */
function PublishPanel({
  s,
  words,
  schedule,
  setSchedule,
  onPublish,
  onClose,
  onField,
  onCategory,
  onCover,
  onRemoveCover,
  onAudio,
  onRemoveAudio,
  onSharePic,
  onRemoveSharePic,
  onSet,
  onPersonPhoto,
}: {
  s: EditorStory;
  words: number;
  schedule: string;
  setSchedule: (v: string) => void;
  onPublish: (when: "now" | "unpublish" | string) => void;
  onClose: () => void;
  onField: (k: "hook" | "originalUrl" | "shareText" | "personName" | "personPlace" | "series" | "sources", v: string) => void;
  onSet: (patch: Partial<EditorStory>) => void;
  onPersonPhoto: (f: File) => void;
  onSharePic: (f: File) => void;
  onRemoveSharePic: () => void;
  onCategory: (c: Category) => void;
  onCover: (f: File) => void;
  onRemoveCover: () => void;
  onAudio: (f: File) => void;
  onRemoveAudio: () => void;
}) {
  const label = "text-[12px] font-semibold tracking-[0.06em] text-mute uppercase";
  const input = "w-full rounded-xl border border-line-strong bg-sheet px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-ink";
  const missing = [!s.title.trim() && "a title", words < 30 && "the story"].filter(Boolean) as string[];
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[var(--scrim)] font-sans" onClick={onClose}>
      <aside aria-label="Publish" className="flex h-full w-full max-w-[440px] flex-col gap-6 overflow-auto border-l border-line bg-bg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold">Publish</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full text-mute hover:bg-soft">
            ×
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className={label}>The one line that makes them read it</span>
          <textarea rows={2} maxLength={240} value={s.hook} onChange={(e) => onField("hook", e.target.value)} placeholder="Shown on the homepage, the list and WhatsApp." className={input} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${label} pb-2`}>Kind of story</legend>
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => onCategory(c)} aria-pressed={s.category === c} className={`h-9 rounded-full border px-4 text-[14px] ${s.category === c ? "border-ink bg-ink text-bg" : "border-line text-ink hover:bg-soft"}`}>
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${label} pb-2`}>The person in this story</legend>
          <div className="flex items-center gap-3">
            {s.personPhotoId ? (
              <button type="button" onClick={() => onSet({ personPhotoId: null })} title="Remove the photo" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- the writer's own upload */}
                <img src={`${MEDIA}${s.personPhotoId}?w=480`} alt="" className="size-14 rounded-full object-cover" />
              </button>
            ) : (
              <FileButton accept="image/*" onFile={onPersonPhoto} className="flex size-14 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-[11px] text-mute hover:text-ink">
                Photo
              </FileButton>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <input value={s.personName} onChange={(e) => onField("personName", e.target.value)} placeholder="Their name" aria-label="Their name" maxLength={120} className={input} />
              <input value={s.personPlace} onChange={(e) => onField("personPlace", e.target.value)} placeholder="Where (e.g. Vijayawada)" aria-label="Where they are" maxLength={120} className={input} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[14px] text-ink">
            <input type="checkbox" checked={s.personConsent} onChange={(e) => onSet({ personConsent: e.target.checked })} className="size-4 accent-[var(--brand-green)]" />
            They agreed to be featured (shows “Shared with their permission”)
          </label>
          <span className="text-[12px] text-mute">Their real photo, never a stock picture. Leave empty for a story about you or about history.</span>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className={label}>Series (optional)</span>
          <input value={s.series} onChange={(e) => onField("series", e.target.value)} placeholder="The man behind the words" maxLength={120} list="series-names" className={input} />
          <span className="text-[12px] text-mute">Stories with the same series name are grouped, with their own page.</span>
        </label>

        <label className="flex flex-col gap-2">
          <span className={label}>Sources (optional, one a line)</span>
          <textarea rows={4} value={s.sources} onChange={(e) => onField("sources", e.target.value)} placeholder={"Andhra Pradesh Day — https://en.wikipedia.org/wiki/Andhra_Pradesh_Day\nThe Hindu, 16 December 1952"} className={`${input} font-mono text-[13px]`} />
          <span className="text-[12px] text-mute">For history: dates and references, shown in a box at the end. End a line with a link to make it one.</span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${label} pb-2`}>Language</legend>
          <div className="flex gap-2">
            {(["en", "te"] as const).map((l) => (
              <button key={l} type="button" onClick={() => onSet({ language: l })} aria-pressed={s.language === l} className={`h-9 rounded-full border px-4 text-[14px] ${s.language === l ? "border-ink bg-ink text-bg" : "border-line text-ink hover:bg-soft"}`}>
                {l === "en" ? "English" : "తెలుగు"}
              </button>
            ))}
          </div>
          {s.translationOf ? (
            <span className="text-[12px] text-mute">This is a translation. Readers of either version get a button to switch.</span>
          ) : (
            <form action={translate.bind(null, s.id, s.language === "te" ? "en" : "te")}>
              <button type="submit" className="text-[13px] text-ink underline underline-offset-2">
                {s.language === "te" ? "Make an English version →" : "Make a Telugu version (తెలుగు) →"}
              </button>
              <span className="block text-[12px] text-mute">A draft copy with the same pictures, person and sources, to translate. Readers get a switch once both are published.</span>
            </form>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className={label}>Cover</span>
          {s.coverId ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- the writer's own upload */}
              <img src={`${MEDIA}${s.coverId}?w=480`} alt="" className="h-16 w-24 rounded-md object-cover" />
              <button type="button" onClick={onRemoveCover} className="text-[14px] text-mute underline">
                Remove
              </button>
            </div>
          ) : (
            <FileButton accept="image/*" onFile={onCover} className="h-10 rounded-xl border border-dashed border-line text-[14px] text-mute hover:text-ink">
              + Add a cover
            </FileButton>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className={label}>Your voice (optional)</span>
          {s.audioId ? (
            <div className="flex flex-col gap-2">
              <audio controls preload="none" src={`${MEDIA}${s.audioId}`} className="w-full" />
              <span className="flex items-center gap-3 text-[13px] text-mute">
                {s.audioDurationSec ? clock(s.audioDurationSec) : ""}
                <button type="button" onClick={onRemoveAudio} className="underline">
                  Remove
                </button>
              </span>
            </div>
          ) : (
            <FileButton accept="audio/*,.m4a,.mp3" onFile={onAudio} className="h-10 rounded-xl border border-dashed border-line text-[14px] text-mute hover:text-ink">
              + Add your recording (MP3, M4A)
            </FileButton>
          )}
          <span className="text-[12px] text-mute">Readers get a Listen button. Without a recording, there is none.</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className={label}>When someone shares it on WhatsApp</span>
          <input type="text" maxLength={160} value={s.shareText} onChange={(e) => onField("shareText", e.target.value)} placeholder="I read this and thought of you." aria-label="WhatsApp message" className={input} />
          <div className="rounded-xl border border-line bg-sheet p-3 text-[13px] leading-snug">
            <p className="text-ink">{s.shareText.trim() || "I read this and thought of you."}</p>
            <p className="mt-1 font-semibold text-ink">{s.title || "Title"}</p>
            {s.hook && <p className="text-mute">{s.hook}</p>}
          </div>
          <div className="flex items-center gap-3">
            {s.shareMediaId ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- the writer's own upload */}
                <img src={`${MEDIA}${s.shareMediaId}?w=480`} alt="" className="h-14 w-24 rounded-md object-cover" />
                <button type="button" onClick={onRemoveSharePic} className="text-[13px] text-mute underline">
                  Use the cover instead
                </button>
              </>
            ) : (
              <FileButton accept="image/*" onFile={onSharePic} className="text-[13px] text-mute underline">
                Use a different picture for the preview (the cover by default)
              </FileButton>
            )}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className={label}>First published elsewhere? (optional)</span>
          <input type="url" value={s.originalUrl ?? ""} onChange={(e) => onField("originalUrl", e.target.value)} placeholder="https://medium.com/…" className={input} />
        </label>

        <div className="flex flex-col gap-2 text-[13px] text-mute">
          <span className={label}>Address</span>
          <span className="break-all text-ink">/stories/{s.slug}</span>
          {s.state === "draft" && <span>Follows the title until it is published, then stays fixed so shared links keep working.</span>}
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-5">
          {missing.length > 0 && <p className="text-[13px] text-red-text">Add {missing.join(" and ")} first.</p>}
          {s.state !== "published" && (
            <button type="button" disabled={missing.length > 0} onClick={() => onPublish("now")} className="h-12 rounded-xl bg-brand-green text-[15px] font-semibold text-on-red hover:brightness-105 disabled:opacity-50">
              Publish now
            </button>
          )}
          <div className="flex gap-2">
            <input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} aria-label="Publish on" className={`${input} flex-1`} />
            <button type="button" disabled={missing.length > 0 || !schedule} onClick={() => onPublish(new Date(schedule).toISOString())} className="h-11 shrink-0 rounded-xl border border-ink px-4 text-[14px] font-semibold text-ink hover:bg-soft disabled:opacity-50">
              Schedule
            </button>
          </div>
          {s.state !== "draft" && (
            <button type="button" onClick={() => onPublish("unpublish")} className="h-10 text-[14px] text-mute underline">
              Unpublish (back to a draft)
            </button>
          )}
          <form action={remove.bind(null, s.id)}>
            <button
              type="submit"
              onClick={(e) => {
                if (!window.confirm("Delete this story for good?")) e.preventDefault();
              }}
              className="h-10 w-full text-[13px] text-red-text"
            >
              Delete story
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

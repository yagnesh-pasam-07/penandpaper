"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { clampSize, listLines, type InkName } from "@/modules/drop/logic";
import { matchPeople, mentionAt, mentionText, type Person } from "@/modules/drop/use-people";
import { MicIcon } from "@/components/icons";
import { useHoldToTalk } from "@/modules/drop/use-hold-to-talk";
import { useVoice } from "@/modules/drop/use-voice";
import { insertAtCursor } from "@/modules/drop/voice";
import { HandText } from "./thought-bubble";

/** How wide written text may run before it wraps, like a hand reaching the edge of a page. */
const WRAP = 420;
/** The base size of written text (size 1). */
const BASE = 22;
/** "[ ] ", "[] " or "- [ ] " typed at the start: the words become a to-do. */
const BOX_TYPED = /^\s*(?:-\s*)?\[\s?\]\s/;

/**
 * What a to-do line can ask of the list it stands in. Each line is its own
 * to-do; the list is how they're written, one after another, without the mouse.
 */
export type ListKeys = {
  /** Enter: this line keeps `before`; `lines` go in under it and the pen goes to the last of them, `caret` in. */
  split: (before: string, lines: { text: string; indent?: number }[], caret: number) => void;
  /** Tab (1) or Shift+Tab (-1): a sub-to-do or not. False if it can't (the first line, or already there). */
  indent: (delta: 1 | -1) => boolean;
  /** Backspace at the very start: these words join the line above, and the pen goes there. Missing on the first line. */
  joinUp?: (text: string) => void;
  /** The arrow keys at the top or bottom: the pen moves to the line above or below. */
  up?: () => void;
  down?: () => void;
};

/**
 * Words written straight on the paper with the Text tool: no card, no tape,
 * just ink. With Select in hand, a click picks it (an outline and a corner to
 * drag bigger or smaller) and a double-click (or Enter) edits; with the Text
 * tool a click edits. Empty on save rubs it out. A blank one opens already
 * editing. With a box in front it's a to-do, and a line of a to-do list:
 * Enter writes the next one under it (see ListKeys).
 */
export function PaperText({
  text,
  seed,
  fresh,
  editing: startEditing = false,
  interim = "",
  leaving,
  onEdit,
  onDelete,
  onDone,
  size = 1,
  color = "ink",
  selectable = false,
  selected = false,
  onSelect,
  onResize,
  todo = false,
  done = false,
  onToggle,
  onMakeTodo,
  onCountdown,
  footer,
  people = [],
  onBox,
  list,
  caret,
  count,
}: {
  text: string;
  seed: string;
  fresh?: boolean;
  /** Opens in the editor (a new one, just placed). */
  editing?: boolean;
  /** Words heard on bare paper (Space held before the pen was down), shown faintly. */
  interim?: string;
  leaving?: "crumple" | null;
  onEdit: (text: string) => void;
  /** Rubbed out: saved empty, or Delete. */
  onDelete: () => void;
  /** The editor closed (saved or not). */
  onDone?: () => void;
  size?: number;
  color?: InkName;
  /** Select is in hand: a click picks it instead of editing. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  /** A corner was dragged: the new size. */
  onResize?: (size: number) => void;
  /** A to-do: a hand-drawn box in front of the words. */
  todo?: boolean;
  done?: boolean;
  /** Tick or untick the box. */
  onToggle?: () => void;
  /** Picked text offers a small box to make it a to-do (or take the box away). */
  onMakeTodo?: () => void;
  /** Picked text: a "Count down" chip beside "To-do" (when it happens). */
  onCountdown?: () => void;
  /** Under the words (a to-do's date chip). */
  footer?: React.ReactNode;
  /** Who "@" can suggest: the people this paper is shared with. */
  people?: Person[];
  /** Typing "[ ] " or "/todo" puts a box in front at once (true), Backspace at the start of a to-do takes it away (false). */
  onBox?: (on: boolean) => void;
  /** Writing a list: Enter, Tab, Backspace, the arrows and a pasted list (see ListKeys). */
  list?: ListKeys;
  /** Where the cursor goes when the pen opens here (the end, if not given). */
  caret?: number;
  /** A to-do with sub-to-dos: how many are done ("1/3"). */
  count?: string;
}) {
  const [live, setLive] = useState<number | null>(null);
  const shown = live ?? size;
  const self = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) self.current?.focus({ preventScroll: true });
  }, [selected]);
  // Set once the pen has been put down here by a list key, so the blur that follows doesn't save twice.
  const closed = useRef(false);
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(text);
  // The pen is open here again: it saves on its own once more.
  useEffect(() => {
    if (editing) closed.current = false;
  }, [editing]);
  // Asked to open again (a new one placed, or speech arriving): adjust while rendering, not in an effect.
  const [asked, setAsked] = useState(startEditing);
  if (startEditing !== asked) {
    setAsked(startEditing);
    if (startEditing && !editing) {
      setDraft(text);
      setEditing(true);
    }
  }
  const finish = () => {
    if (closed.current) return;
    const next = draft.trim();
    setEditing(false);
    onDone?.();
    if (!next) onDelete();
    else if (next !== text) onEdit(next);
  };
  /** Puts the pen down here without saving (the list does it), then `then`. */
  const handOff = (then: () => void) => {
    closed.current = true;
    setEditing(false);
    onDone?.();
    then();
  };
  /** Saves what's written (or rubs it out, if nothing), then moves the pen with `then`. */
  const moveOn = (then: () => void) => {
    finish();
    closed.current = true;
    then();
  };

  const ink: CSSProperties = { maxWidth: WRAP * Math.max(1, shown), fontSize: BASE * shown, color: `var(--ink-${color})` };
  const open = () => {
    setDraft(text);
    setEditing(true);
  };

  /** The corner handle: drag away from the text to grow it, towards it to shrink. */
  const resize = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = self.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const startDiag = Math.hypot(r.width, r.height) || 1;
    const sx = e.clientX;
    const sy = e.clientY;
    let next = size;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const grow = (Math.hypot(r.width + (ev.clientX - sx), r.height + (ev.clientY - sy)) * Math.sign(r.width + (ev.clientX - sx))) / startDiag;
      // Steps of 2 px, unless Shift is held.
      const raw = clampSize(size * grow);
      next = ev.shiftKey ? raw : clampSize(Math.round((raw * BASE) / 2) * 2 / BASE);
      setLive(next);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setLive(null);
      if (ev.type === "pointerup" && next !== size) onResize?.(next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const motion = leaving === "crumple" ? "fade-away" : fresh && !startEditing ? "drop-in" : "";

  const box = todo ? <TodoBox done={done} size={shown} color={color} onToggle={onToggle} /> : null;
  if (editing) {
    const editor = (
      <TextEditor
        draft={draft}
        setDraft={setDraft}
        interim={interim}
        style={ink}
        onFinish={finish}
        // The hint shows only on fresh text just placed, never when editing words already written.
        hint={!text && !todo}
        people={people}
        onHeading={() => onResize?.(size >= 1.8 ? 1 : 2)}
        todo={todo}
        onBox={onBox}
        caret={caret}
        list={
          list && {
            split: (before, lines, at) => handOff(() => list.split(before, lines, at)),
            indent: list.indent,
            joinUp: list.joinUp && ((words) => handOff(() => list.joinUp!(words))),
            up: list.up && (() => moveOn(list.up!)),
            down: list.down && (() => moveOn(list.down!)),
          }
        }
      />
    );
    // The box stays while the words are written, so the line doesn't jump. The same
    // wrapper either way: the box arriving ("[ ] " typed) never rebuilds the textarea.
    return (
      <div className={todo ? "flex items-start" : undefined} style={todo ? { gap: 10 * shown } : undefined}>
        {box}
        <div className={todo ? "min-w-0 flex-1" : undefined}>{editor}</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {selected && onMakeTodo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMakeTodo();
          }}
          title={todo ? "Make it plain text again" : "Make it a to-do · or type [ ] at the start"}
          className="absolute -top-9 left-0 flex h-7 items-center gap-1.5 rounded-lg border border-line bg-raised px-2 font-sans text-[12px] font-medium whitespace-nowrap text-ink shadow-[0_8px_20px_-12px_var(--shadow)] hover:bg-soft"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <rect x="1.5" y="1.5" width="9" height="9" rx="2" />
            {!todo && <path d="M3.8 6.2l1.6 1.6 3-3.4" />}
          </svg>
          {todo ? "Plain text" : "To-do"}
        </button>
      )}
      {selected && onCountdown && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCountdown();
          }}
          title="Count down to a day"
          className={`absolute -top-9 ${onMakeTodo ? "left-[92px]" : "left-0"} flex h-7 items-center gap-1.5 rounded-lg border border-line bg-raised px-2 font-sans text-[12px] font-medium whitespace-nowrap text-ink shadow-[0_8px_20px_-12px_var(--shadow)] hover:bg-soft`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <rect x="1.5" y="2.5" width="9" height="8" rx="1.5" />
            <path d="M1.5 5h9M4 1.2v2.4M8 1.2v2.4" />
          </svg>
          Count down
        </button>
      )}
      <div className={todo ? "flex items-start" : undefined} style={todo ? { gap: 10 * shown } : undefined}>
      {box}
      <div
        ref={self}
        role="button"
        tabIndex={0}
        data-paper-text=""
        data-keys=""
        aria-label={`Written: ${text}. ${selectable ? "Double-click or Enter to edit" : "Enter to edit"}, Delete to rub out.`}
        aria-pressed={selectable ? selected : undefined}
        style={ink}
        onClick={() => (selectable ? onSelect?.() : open())}
        onDoubleClick={() => selectable && open()}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter") {
            e.preventDefault();
            open();
          } else if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            onDelete();
          }
        }}
        className={`paper-text hand font-note leading-snug break-words whitespace-pre-wrap outline-none ${motion} ${fresh ? "write-on" : ""} ${done ? "is-done opacity-55" : ""} ${
          selected ? "rounded-md ring-1 ring-red-text/70 ring-offset-4 ring-offset-transparent" : ""
        }`}
      >
        <span className={todo ? "pen-strike" : undefined}>
          <HandText text={text} seed={seed} />
        </span>
        {count && <span className="ml-2 align-middle font-mono text-[11px] text-mute" aria-label={`${count} sub-to-dos done`}>{count}</span>}
        {footer && <span className="mt-1 block font-sans">{footer}</span>}
      </div>
      </div>
      {selected && onResize && (
        <button
          type="button"
          aria-label="Drag to resize the text"
          title="Drag to resize · Shift for any size"
          onPointerDown={resize}
          className="absolute -right-2.5 -bottom-2.5 size-3 cursor-nwse-resize rounded-[3px] border border-red-text bg-sheet"
        />
      )}
      {live !== null && (
        <span className="pointer-events-none absolute -top-7 left-0 rounded-md bg-ink px-1.5 py-0.5 font-mono text-[11px] text-bg">{Math.round(live * BASE)} px</span>
      )}
    </div>
  );
}

/**
 * The open pen: a bare textarea on the paper with its own voice. Hold Space
 * (like Claude's CLI) or click the mic and speak; the words appear faintly as
 * they are heard and go in at the cursor when you stop.
 */
function TextEditor({
  draft,
  setDraft,
  interim: outside,
  style,
  onFinish,
  hint,
  people,
  onHeading,
  todo,
  onBox,
  caret,
  list,
}: {
  draft: string;
  setDraft: (fn: (d: string) => string) => void;
  interim: string;
  style: CSSProperties;
  onFinish: () => void;
  hint: boolean;
  people: Person[];
  onHeading: () => void;
  todo: boolean;
  onBox?: (on: boolean) => void;
  caret?: number;
  list?: ListKeys;
}) {
  // The "/" menu and "@" suggestions: what's being typed after the trigger, and which row is lit.
  const [cursor, setCursor] = useState(draft.length);
  const [lit, setLit] = useState(0);
  const [shut, setShut] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  // Where the words go: the cursor when listening started.
  const at = useRef<{ start: number; end: number } | null>(null);
  const voice = useVoice(
    (words) => {
      const where = at.current ?? { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };
      let cursor = 0;
      setDraft((d) => {
        const next = insertAtCursor(d, words, where.start, where.end, 2000);
        cursor = next.cursor;
        return next.text;
      });
      at.current = null;
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.setSelectionRange(cursor, cursor);
      });
    },
    { hold: true },
  );
  const listening = voice.state.kind === "recording";
  const working = voice.state.kind === "transcribing";
  const mark = () => {
    const el = area.current;
    at.current = { start: el?.selectionStart ?? draft.length, end: el?.selectionEnd ?? draft.length };
  };
  const talk = useHoldToTalk(
    {
      ...voice,
      start: () => {
        mark();
        voice.start();
      },
    },
    area,
    setDraft,
  );
  const heard = voice.interim || outside;

  const slash = slashAt(draft, cursor);
  const mention = mentionAt(draft, cursor);
  const commands = slash ? COMMANDS.filter((c) => c.label.toLowerCase().includes(slash.query) || c.keys.some((k) => k.startsWith(slash.query))) : [];
  const suggestions = mention ? matchPeople(people, mention.query) : [];
  const menuKey = slash ? `/${slash.start}` : mention ? `@${mention.start}` : null;
  const open = menuKey !== null && menuKey !== shut && (slash ? commands.length > 0 : suggestions.length > 0);
  const rows = slash ? commands.length : suggestions.length;
  const row = Math.min(lit, Math.max(0, rows - 1));

  /** Replaces text[from, cursor) with `insert`, then puts the cursor after it. */
  const splice = (from: number, insert: string, prefixLine?: string) => {
    let pos = from + insert.length;
    setDraft((d) => {
      let next = d.slice(0, from) + insert + d.slice(cursor);
      if (prefixLine !== undefined) {
        const lineStart = next.lastIndexOf("\n", from - 1) + 1;
        const line = next.slice(lineStart);
        if (!line.startsWith(prefixLine)) {
          next = next.slice(0, lineStart) + prefixLine + line;
          pos += prefixLine.length;
        }
      }
      return next;
    });
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
      setCursor(pos);
    });
  };
  const choose = (i: number) => {
    setLit(0);
    if (slash) {
      const c = commands[i];
      if (!c) return;
      if (c.id === "todo") {
        const lineStart = draft.lastIndexOf("\n", slash.start - 1) + 1;
        const rest = draft.slice(0, slash.start) + draft.slice(cursor);
        if (onBox && lineStart === 0) {
          // The box goes in front at once; the words stay as they are.
          splice(slash.start, "");
          if (!todo) onBox(true);
        } else if (list && lineStart > 0) {
          // On a later line of plain words: the lines above stay as they are, and this one starts a list under them.
          list.split(rest.slice(0, lineStart).trimEnd(), [{ text: rest.slice(lineStart) }], slash.start - lineStart);
        } else splice(slash.start, "", "[ ] ");
      }
      else if (c.id === "list") splice(slash.start, "", "• ");
      else if (c.id === "heading") {
        splice(slash.start, "");
        onHeading();
      } else if (c.id === "remind") splice(slash.start, (slash.start > 0 && !/\s$/.test(draft.slice(0, slash.start)) ? " " : "") + "remind me ");
      else if (c.id === "mention") splice(slash.start, "@");
    } else if (mention) {
      const p = suggestions[i];
      if (p) splice(mention.start, `${mentionText(p)} `);
    }
  };
  // Leaving the box while listening keeps the words: finish only once they've landed.
  const busy = listening || working;

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.focus();
    const at = caret === undefined ? el.value.length : Math.min(caret, el.value.length);
    el.setSelectionRange(at, at);
    setCursor(at);
    // Only where the pen first lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The editor grows with what's written, like the ink would.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, heard]);

  return (
    <div className="relative" style={style} data-paper-text="">
      <label htmlFor={id} className="sr-only">
        Write on the paper
      </label>
      <textarea
        id={id}
        ref={area}
        value={draft}
        rows={1}
        placeholder={hint ? "Write, or hold Space to talk…" : undefined}
        readOnly={listening}
        onChange={(e) => {
          let value = e.target.value;
          let pos = e.target.selectionStart ?? value.length;
          // "[ ] " (or "[] ") typed at the start: the box goes in front now, not when the pen is put down.
          const typed = onBox && !todo ? BOX_TYPED.exec(value) : null;
          if (typed) {
            value = value.slice(typed[0].length);
            pos = Math.max(0, pos - typed[0].length);
            onBox!(true);
            requestAnimationFrame(() => area.current?.setSelectionRange(pos, pos));
          }
          setDraft(() => value);
          setCursor(pos);
          setLit(0);
        }}
        onPaste={(e) => {
          // A list pasted into a to-do: a to-do for each line.
          if (!todo || !list) return;
          const lines = listLines(e.clipboardData.getData("text/plain"));
          if (lines.length < 2) return;
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart ?? draft.length;
          const tail = draft.slice(el.selectionEnd ?? start);
          const [first, ...rest] = lines;
          const last = rest[rest.length - 1];
          list.split(
            draft.slice(0, start) + first.text,
            rest.map((l, i) => (i === rest.length - 1 ? { ...l, text: l.text + tail } : l)),
            last.text.length,
          );
        }}
        onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
        onBlur={(e) => {
          // A click on the mic, or words still being heard: keep the pen up.
          if ((e.relatedTarget as HTMLElement | null)?.closest("[data-text-mic]") || busy) return;
          onFinish();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (open) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setLit((row + (e.key === "ArrowDown" ? 1 : rows - 1)) % rows);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              choose(row);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setShut(menuKey);
              return;
            }
          }
          // Writing a to-do list: each Enter is a new to-do under this one; Tab makes it a sub-to-do.
          if (todo && list && !e.nativeEvent.isComposing) {
            const el = e.currentTarget;
            const start = el.selectionStart ?? draft.length;
            const end = el.selectionEnd ?? start;
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              // An empty to-do: out of the sub-list first, then out of the list (the pen goes down, the empty line goes).
              if (!draft.trim()) {
                if (!list.indent(-1)) el.blur();
                return;
              }
              list.split(draft.slice(0, start), [{ text: draft.slice(end) }], 0);
              return;
            }
            if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
              e.preventDefault();
              list.indent(e.shiftKey ? -1 : 1);
              return;
            }
            if (e.key === "Backspace" && start === 0 && end === 0 && !e.metaKey && !e.altKey) {
              // At the very start: out of the sub-list, then into the line above, then the box comes off.
              if (list.indent(-1)) {
                e.preventDefault();
                return;
              }
              if (list.joinUp) {
                e.preventDefault();
                list.joinUp(draft);
                return;
              }
              if (onBox) {
                e.preventDefault();
                onBox(false);
                return;
              }
            }
            if (e.key === "ArrowUp" && list.up && !e.shiftKey && !e.altKey && !e.metaKey && !draft.slice(0, start).includes("\n")) {
              e.preventDefault();
              list.up();
              return;
            }
            if (e.key === "ArrowDown" && list.down && !e.shiftKey && !e.altKey && !e.metaKey && !draft.slice(end).includes("\n")) {
              e.preventDefault();
              list.down();
              return;
            }
          }
          // A list keeps going: Enter on a "• " or "[ ] " line starts the next one the same way.
          if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
            const pos = area.current?.selectionStart ?? draft.length;
            const lineStart = draft.lastIndexOf("\n", pos - 1) + 1;
            const line = draft.slice(lineStart, pos);
            const mark = /^(• |\[ \] )/.exec(line)?.[1];
            if (mark && line.length > mark.length) {
              e.preventDefault();
              splice(pos, `\n${mark}`);
              return;
            }
          }
          if (talk.onKeyDown(e)) return;
          // Enter is a new line, as on paper; Esc or ⌘/Ctrl+Enter puts the pen down.
          if (e.key === "Escape" && (listening || working)) {
            e.preventDefault();
            voice.cancel();
          } else if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            area.current?.blur();
          }
        }}
        onKeyUp={(e) => {
          e.stopPropagation();
          talk.onKeyUp(e);
        }}
        style={{ fontSize: style.fontSize, color: style.color, width: `min(${style.maxWidth}px, 80vw)` }}
        className="hand block resize-none overflow-hidden bg-transparent p-0 pr-10 font-note leading-snug caret-red-text outline-none placeholder:font-sans placeholder:text-[15px] placeholder:text-mute/70"
      />
      {open && (
        <div
          role="listbox"
          aria-label={slash ? "Add" : "Mention someone on this paper"}
          onPointerDown={(e) => {
            // Keep the pen up: a click on the menu isn't a click away.
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute top-full left-0 z-40 mt-1.5 w-[248px] overflow-hidden rounded-xl border border-line bg-raised py-1 font-sans shadow-[0_18px_40px_-18px_var(--shadow)]"
        >
          {slash && <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-mute uppercase">Add</p>}
          {!slash && <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-mute uppercase">On this paper</p>}
          {slash
            ? commands.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={i === row}
                  onMouseEnter={() => setLit(i)}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-[14px] text-ink ${i === row ? "bg-soft" : ""}`}
                >
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${i === row ? "bg-red-soft text-red-text" : "text-mute"}`}>{ICONS[c.id]}</span>
                  <span className="flex-1">
                    <span className="block leading-tight">{c.label}</span>
                    <span className="block text-[11px] leading-tight text-graphite">{c.hint}</span>
                  </span>
                </button>
              ))
            : suggestions.map((p, i) => (
                <button
                  key={p.email}
                  type="button"
                  role="option"
                  aria-selected={i === row}
                  onMouseEnter={() => setLit(i)}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[14px] ${i === row ? "bg-soft" : ""}`}
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-red-soft text-[11px] font-semibold text-red-text uppercase">{(p.name ?? p.email)[0]}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {p.name ?? p.email} {p.name && <span className="text-[12px] text-mute">{p.email}</span>}
                  </span>
                </button>
              ))}
        </div>
      )}
      {heard && <span style={{ fontSize: style.fontSize }} className="pointer-events-none block font-note leading-snug text-mute/70">{heard}</span>}
      {voice.supported && (
        <button
          type="button"
          data-text-mic=""
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Speak (or hold Space)"}
          title={listening ? "Stop listening" : "Speak · or hold Space"}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={() => {
            if (!listening) mark();
            voice.toggle();
            area.current?.focus();
          }}
          className={`absolute top-0 -right-1 flex size-8 items-center justify-center rounded-full transition-colors ${
            listening ? "bg-red text-on-red shadow-[0_0_0_6px_color-mix(in_srgb,var(--red)_22%,transparent)]" : working ? "text-mute" : "text-mute hover:bg-soft hover:text-red-text"
          }`}
        >
          {listening ? <span className="voice-dot size-2.5 rounded-full bg-on-red" aria-hidden="true" /> : <MicIcon size={16} />}
        </button>
      )}
      {(listening || working || voice.state.kind === "failed") && (
        <span role="status" className={`mt-1 block font-sans text-[12px] ${voice.state.kind === "failed" ? "text-red-text" : "text-mute"}`}>
          {voice.state.kind === "failed" && "message" in voice.state ? String(voice.state.message) : listening ? "Listening… let go of Space, or click the mic" : "Writing it down…"}
        </span>
      )}
    </div>
  );
}

/**
 * The box in front of a written to-do: drawn by hand in the text's own ink,
 * the size of a capital letter. Ticked, a red pen stroke goes through it.
 */
export function TodoBox({ done, size, color, onToggle }: { done: boolean; size: number; color: InkName; onToggle?: () => void }) {
  const px = Math.round(BASE * size * 0.82);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? "Done. Untick" : "Tick it off"}
      data-drag=""
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="group/box shrink-0 cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-red-text"
      style={{ width: px, height: px, marginTop: BASE * size * 0.32 }}
    >
      <svg viewBox="0 0 20 20" width={px} height={px} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.2 3.6c4.4-.5 9.3-.6 13.6-.2.4 4.3.5 8.7.1 13.1-4.4.5-9 .5-13.4.1-.5-4.3-.6-8.6-.3-13z" style={{ stroke: `var(--ink-${color})` }} strokeWidth={1.6} className="transition-opacity group-hover/box:opacity-70" />
        {done && <path d="M5 10.4l3.4 3.6L16 4.6" className="ink-draw stroke-red-text" strokeWidth={2.4} pathLength={1} style={{ "--len": 1 } as CSSProperties} />}
      </svg>
    </button>
  );
}

/** The "/word" being typed at the cursor (after a space or at a line start), if any. */
function slashAt(text: string, cursor: number): { start: number; query: string } | null {
  const m = /(^|\s)\/([a-z]*)$/i.exec(text.slice(0, cursor));
  return m ? { start: cursor - m[2].length - 1, query: m[2].toLowerCase() } : null;
}

/**
 * What "/" offers on the paper. Five, on purpose: each one is something a
 * thinker does (decide, remember, structure, bring someone in), and each is
 * also a thing you can just type ("[ ] ", "• ", "remind me …", "@").
 */
/** Drawn like the tool bar's icons: one ink, round ends, a hand's slight wobble, never an emoji. */
const ink = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const ICONS = {
  todo: (
    <svg {...ink}>
      <path d="M4.2 4.6c3.6-.4 7.7-.5 11.4-.1.3 3.6.4 7.3 0 10.9-3.7.4-7.5.4-11.2 0-.4-3.6-.5-7.2-.2-10.8z" />
      <path d="M7 10.2l2.3 2.4 4.6-5.4" />
    </svg>
  ),
  remind: (
    <svg {...ink}>
      <path d="M10 4.4c3.5-.1 6 2.5 6 5.9 0 3.3-2.6 5.8-6 5.8s-6-2.5-6-5.8c0-3.4 2.5-5.8 6-5.9z" />
      <path d="M10 7.2v3.3l2.2 1.4M3.6 5.4l2-1.7M16.4 5.4l-2-1.7" />
    </svg>
  ),
  heading: (
    <svg {...ink}>
      <path d="M5 4.6c-.2 3.7-.1 7.4.1 11M5.1 10.2c2-.2 4-.2 6 0M11.2 4.5c-.1 3.8 0 7.4.2 11.1" />
      <path d="M14.2 9.2l1.8-1.2v7.6" />
    </svg>
  ),
  list: (
    <svg {...ink}>
      <circle cx="4.6" cy="6" r=".9" fill="currentColor" />
      <circle cx="4.6" cy="10.2" r=".9" fill="currentColor" />
      <circle cx="4.6" cy="14.4" r=".9" fill="currentColor" />
      <path d="M8 6.1c2.6-.2 5.3-.2 8 0M8 10.2c2.4-.1 4.9-.1 7.2.1M8 14.4c2.6-.2 5.2-.2 7.8 0" />
    </svg>
  ),
  mention: (
    <svg {...ink}>
      <path d="M13.2 10.1c0 1.9-1.4 3.2-3.2 3.2s-3.1-1.4-3.1-3.2S8.3 6.9 10 6.9s3.2 1.3 3.2 3.2zM13.2 7.4v3.8c0 1.4.8 2.1 1.7 2.1s1.6-.9 1.6-2.9c0-3.8-2.8-6.4-6.5-6.4S3.5 6.7 3.5 10.3s2.8 6.3 6.5 6.3c1.3 0 2.4-.3 3.3-.8" />
    </svg>
  ),
};

const COMMANDS: { id: keyof typeof ICONS; label: string; hint: string; keys: string[] }[] = [
  { id: "todo", label: "To-do", hint: "Enter for the next · Tab to nest · or type [ ]", keys: ["todo", "task", "check"] },
  { id: "remind", label: "Remind me", hint: "…tomorrow at 5, friday, in 2 hours", keys: ["remind", "date", "due", "reminder"] },
  { id: "heading", label: "Heading", hint: "Bigger words, to name a part", keys: ["heading", "title", "h1", "big"] },
  { id: "list", label: "List", hint: "Points · Enter for the next", keys: ["list", "bullet", "points"] },
  { id: "mention", label: "Mention someone", hint: "Someone this paper is shared with", keys: ["mention", "person", "people", "@"] },
];

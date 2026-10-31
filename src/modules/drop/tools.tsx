"use client";

import type { ReactNode } from "react";

/**
 * The canvas tools. Three, on purpose: a pen and paper doesn't need more.
 * Select moves and edits things; Text writes straight on the paper; Draw puts
 * ink down, and a line drawn from one thing to another ties them together.
 * The eraser is Draw's other end, as on a pencil.
 */
export type Tool = "select" | "text" | "draw" | "erase";

export const TOOL_KEYS: Record<string, Tool> = { v: "select", t: "text", p: "draw", d: "draw", e: "erase" };

type Def = { tool: Tool; label: string; key: string; hint: string; icon: ReactNode };

const icon = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const TOOLS: Def[] = [
  {
    tool: "select",
    label: "Select",
    key: "V",
    hint: "Move, edit and arrange",
    icon: (
      <svg {...icon}>
        <path d="M5 3.5l10 5.2-4.4 1.3L8.4 15z" fill="currentColor" fillOpacity={0.12} />
      </svg>
    ),
  },
  {
    tool: "text",
    label: "Text",
    key: "T",
    hint: "Click anywhere and write · hold Space to speak",
    icon: (
      <svg {...icon}>
        <path d="M4.5 5.2c1.9-.5 9.2-.6 11 0M10 5v10.6M7.9 15.6h4.2" />
      </svg>
    ),
  },
  {
    tool: "draw",
    label: "Draw",
    key: "P",
    hint: "Draw freely · from one thing to another to connect them",
    icon: (
      <svg {...icon}>
        <path d="M3.5 15.8c2.2-.2 3.4-1.9 4.6-3.6 1.4-2 2.6-4.3 5.6-5.3" />
        <path d="M12.4 4.4l3 3.1" />
        <circle cx="4" cy="15.6" r=".6" fill="currentColor" />
      </svg>
    ),
  },
  {
    tool: "erase",
    label: "Eraser",
    key: "E",
    hint: "Rub out lines",
    icon: (
      <svg {...icon}>
        <path d="M8.2 15.5L3.8 11a1.4 1.4 0 010-2l5.8-5.8a1.4 1.4 0 012 0l4.4 4.4a1.4 1.4 0 010 2l-6 6z" />
        <path d="M6.2 8.6l5.2 5.2M8.2 15.5h8" />
      </svg>
    ),
  },
];

/** The tool bar at the top of the canvas: pick a tool with a click or its key. */
export function Toolbar({ tool, onTool, listening }: { tool: Tool; onTool: (t: Tool) => void; listening: boolean }) {
  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      data-no-pan=""
      className="fixed top-[68px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-line bg-sheet p-1 shadow-[0_10px_30px_-16px_var(--shadow)] max-sm:hidden"
    >
      {TOOLS.map((d, i) => {
        const on = tool === d.tool;
        return (
          <span key={d.tool} className="flex items-center">
            {i === TOOLS.length - 1 && <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />}
            <button
              type="button"
              aria-pressed={on}
              aria-label={`${d.label} (${d.key})`}
              title={`${d.label} · ${d.hint}`}
              onClick={() => onTool(d.tool)}
              className={`group/tool relative flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-text ${
                on ? "bg-red-soft text-red-text" : "text-ink hover:bg-soft"
              }`}
            >
              {d.icon}
              <span className={`absolute right-1 bottom-0.5 font-mono text-[9px] leading-none ${on ? "text-red-text/80" : "text-mute/70"}`}>{d.key}</span>
            </button>
          </span>
        );
      })}
      {listening && (
        <span role="status" className="ml-1 flex h-10 items-center gap-2 rounded-xl bg-red-soft px-3 text-[13px] font-medium text-red-text">
          <span className="voice-dot size-2 rounded-full bg-red-text" aria-hidden="true" />
          Listening… let go of Space
        </span>
      )}
    </div>
  );
}

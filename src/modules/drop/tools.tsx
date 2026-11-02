"use client";

import type { ReactNode } from "react";
import { INK_MEANING, INKS, type InkName, type ShapeKind } from "./logic";

/**
 * The canvas tools. Four, on purpose: a pen and paper doesn't need more.
 * Select picks, moves and resizes things (double-click edits); Text writes
 * straight on the paper; Draw puts ink down, and a line drawn from one thing
 * to another ties them together; Shape draws a rectangle or an ellipse. The
 * eraser is Draw's other end, as on a pencil.
 */
export type Tool = "select" | "text" | "draw" | "shape" | "erase";

/** Number keys pick tools (letters are left for typing, which opens the writer). */
export const TOOL_ORDER: Tool[] = ["select", "text", "draw", "shape", "erase"];

type Def = { tool: Tool; label: string; key: string; hint: string; icon: ReactNode };

const icon = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const TOOLS: Def[] = [
  {
    tool: "select",
    label: "Select",
    key: "1",
    hint: "Pick, move and resize · double-click to edit",
    icon: (
      <svg {...icon}>
        <path d="M5 3.5l10 5.2-4.4 1.3L8.4 15z" fill="currentColor" fillOpacity={0.12} />
      </svg>
    ),
  },
  {
    tool: "text",
    label: "Text",
    key: "2",
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
    key: "3",
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
    tool: "shape",
    label: "Shape",
    key: "4",
    hint: "Drag a rectangle or an ellipse · Shift for a square or circle · press 4 again to switch",
    icon: (
      <svg {...icon}>
        <rect x="3.2" y="5" width="9" height="8" rx="1.4" />
        <circle cx="13.6" cy="12.4" r="3.6" fill="currentColor" fillOpacity={0.12} />
      </svg>
    ),
  },
  {
    tool: "erase",
    label: "Eraser",
    key: "5",
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
export function Toolbar({
  tool,
  onTool,
  listening,
  shape,
  onShape,
  color,
  onColor,
  showColors,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  listening: boolean;
  shape: ShapeKind;
  onShape: (s: ShapeKind) => void;
  color: InkName;
  onColor: (c: InkName) => void;
  /** The five inks show while drawing, or while something is picked (to re-colour it). */
  showColors: boolean;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      data-no-pan=""
      className="fixed top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-line bg-sheet p-1 shadow-[0_10px_30px_-16px_var(--shadow)] max-sm:hidden"
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
              onClick={() => (d.tool === "shape" && on ? onShape(shape === "rect" ? "ellipse" : "rect") : onTool(d.tool))}
              className={`group/tool relative flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-text ${
                on ? "bg-red-soft text-red-text" : "text-ink hover:bg-soft"
              }`}
            >
              {d.tool === "shape" ? (
                shape === "ellipse" ? (
                  <svg {...icon}><ellipse cx="10" cy="10" rx="7" ry="5.2" /></svg>
                ) : (
                  <svg {...icon}><rect x="3.4" y="5" width="13.2" height="10" rx="1.6" /></svg>
                )
              ) : (
                d.icon
              )}
              <span className={`absolute right-1 bottom-0.5 font-mono text-[9px] leading-none ${on ? "text-red-text/80" : "text-mute/70"}`}>{d.key}</span>
            </button>
          </span>
        );
      })}
      {tool === "shape" && (
        <span className="ml-0.5 flex items-center rounded-xl bg-soft p-0.5">
          {(["rect", "ellipse"] as ShapeKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={shape === k}
              aria-label={k === "rect" ? "Rectangle" : "Ellipse"}
              title={k === "rect" ? "Rectangle" : "Ellipse"}
              onClick={() => onShape(k)}
              className={`flex size-8 items-center justify-center rounded-lg ${shape === k ? "bg-sheet text-red-text shadow-sm" : "text-mute hover:text-ink"}`}
            >
              {k === "rect" ? <svg {...icon} width={15} height={15}><rect x="3.4" y="5" width="13.2" height="10" rx="1.6" /></svg> : <svg {...icon} width={15} height={15}><ellipse cx="10" cy="10" rx="7" ry="5.2" /></svg>}
            </button>
          ))}
        </span>
      )}
      {showColors && (
        <span role="radiogroup" aria-label="Ink colour" className="ml-1 flex items-center gap-1 border-l border-line pl-2">
          {INKS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={INK_MEANING[c]}
              title={INK_MEANING[c]}
              onClick={() => onColor(c)}
              className={`flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110 ${color === c ? "ring-2 ring-line-strong ring-offset-2 ring-offset-sheet" : ""}`}
            >
              <span className="size-4 rounded-full" style={{ background: `var(--ink-${c})` }} />
            </button>
          ))}
        </span>
      )}
      {listening && (
        <span role="status" className="ml-1 flex h-10 items-center gap-2 rounded-xl bg-red-soft px-3 text-[13px] font-medium text-red-text">
          <span className="voice-dot size-2 rounded-full bg-red-text" aria-hidden="true" />
          Listening… let go of Space
        </span>
      )}
    </div>
  );
}

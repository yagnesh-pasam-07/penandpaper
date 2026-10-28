"use client";

import { AppearanceSync } from "@/components/appearance";
import { applyAppearance, saveAppearance, useCanvas, useThemeMode } from "@/lib/appearance";
import { CANVASES, THEME_MODES, type CanvasId, type ThemeMode } from "@/lib/canvases";
import { COLUMN, DropHeader, type Me } from "./chrome";

const MODE_LABEL: Record<ThemeMode, string> = { light: "Light", dark: "Dark", system: "System" };

/** Settings: for now, how the sheet looks. */
export function SettingsView({ me, appearance }: { me: Me; appearance: { canvas: string | null; theme: string | null } }) {
  const canvas = useCanvas();
  const mode = useThemeMode();

  const pickCanvas = (id: CanvasId) => {
    applyAppearance({ canvas: id });
    void saveAppearance({ canvas: id });
  };
  const pickMode = (m: ThemeMode) => {
    applyAppearance({ mode: m });
    void saveAppearance({ theme: m });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppearanceSync canvas={appearance.canvas} theme={appearance.theme} />
      <DropHeader me={me} title={<h1 className="font-hand text-[26px] leading-none font-bold">Settings</h1>} />
      <main className={`${COLUMN} flex flex-1 flex-col gap-8 px-4 pt-8 pb-16 sm:px-8`}>
        <section aria-labelledby="appearance" className="flex flex-col gap-6">
          <h2 id="appearance" className="font-hand text-[30px] leading-none font-bold">
            Appearance
          </h2>

          <div role="radiogroup" aria-label="Canvas" className="flex flex-col gap-3">
            <span className="text-[13px] font-medium text-mute">Canvas</span>
            <div className="grid grid-cols-2 gap-3 sm:max-w-[520px]">
              {CANVASES.map((c) => {
                const on = c.id === canvas;
                return (
                  // data-canvas on the card lets its preview show this canvas, whatever is selected.
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-canvas={c.id}
                    onClick={() => pickCanvas(c.id)}
                    className={`canvas-preview flex flex-col gap-2 rounded-2xl border p-2 text-left ${on ? "border-red-text bg-red-soft/40" : "border-line bg-sheet hover:bg-soft"}`}
                  >
                    <span aria-hidden="true" className="canvas-surface block h-24 rounded-xl border border-line" />
                    <span className="flex flex-col px-1 pb-1">
                      <span className="text-sm font-semibold">{c.label}</span>
                      <span className="text-[13px] text-mute">{c.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-3">
            <span className="text-[13px] font-medium text-mute">Theme</span>
            <div className="inline-flex w-fit rounded-xl border border-line bg-sheet p-1">
              {THEME_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={m === mode}
                  onClick={() => pickMode(m)}
                  className={`h-9 rounded-lg px-4 text-sm font-medium ${m === mode ? "bg-ink text-bg" : "text-mute hover:bg-soft hover:text-ink"}`}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

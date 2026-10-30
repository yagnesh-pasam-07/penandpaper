"use client";

import Link from "next/link";
import { AppearanceSync } from "@/components/appearance";
import { applyAppearance, applyNoteFont, saveAppearance, useCanvas, useNoteFont, useThemeMode } from "@/lib/appearance";
import { CANVASES, NOTE_FONTS, THEME_MODES, type CanvasId, type NoteFont, type ThemeMode } from "@/lib/canvases";
import { COLUMN, DropHeader, type Me } from "./chrome";
import { DesktopTokens } from "./desktop-tokens";

const MODE_LABEL: Record<ThemeMode, string> = { light: "Light", dark: "Dark", system: "System" };

/** Settings: how the sheet looks, and the keys desktop apps save with. */
export function SettingsView({ me, appearance }: { me: Me; appearance: { canvas: string | null; theme: string | null; noteFont: string | null } }) {
  const canvas = useCanvas();
  const mode = useThemeMode();
  const noteFont = useNoteFont();

  const pickCanvas = (id: CanvasId) => {
    applyAppearance({ canvas: id });
    void saveAppearance({ canvas: id });
  };
  const pickFont = (f: NoteFont) => {
    applyNoteFont(f);
    void saveAppearance({ noteFont: f });
  };
  const pickMode = (m: ThemeMode) => {
    applyAppearance({ mode: m });
    void saveAppearance({ theme: m });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppearanceSync canvas={appearance.canvas} theme={appearance.theme} noteFont={appearance.noteFont} />
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

          <div role="radiogroup" aria-label="How thoughts are written" className="flex flex-col gap-3">
            <span className="text-[13px] font-medium text-mute">How thoughts are written</span>
            <div className="grid grid-cols-2 gap-3 sm:max-w-[520px]">
              {NOTE_FONTS.map((f) => {
                const on = f.id === noteFont;
                return (
                  // Each card writes the same sample in its own font, whatever is selected.
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickFont(f.id)}
                    className={`flex flex-col gap-2 rounded-2xl border p-3 text-left ${on ? "border-red-text bg-red-soft/40" : "border-line bg-sheet hover:bg-soft"}`}
                  >
                    <span aria-hidden="true" data-note-font={f.id} className="note-sample font-note text-[20px] leading-snug text-ink">
                      Pitch the pilot to 3 clinics
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{f.label}</span>
                      <span className="text-[13px] text-mute">{f.hint}</span>
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

        <section aria-labelledby="capture" className="flex flex-col gap-2">
          <h2 id="capture" className="font-hand text-[30px] leading-none font-bold">
            Capture from your phone
          </h2>
          <p className="max-w-[60ch] text-[15px] text-mute">
            Add Pen &amp; Paper to your home screen, then use Share on a link, text or picture in any app and choose Pen &amp; Paper: it lands on your latest paper. Android (Chrome) has Share and a &ldquo;New thought&rdquo; shortcut; on iPhone, Add to Home Screen opens the app, and you can start typing as soon as it opens.
          </p>
        </section>

        <section aria-labelledby="extension" className="flex flex-col gap-3">
          <h2 id="extension" className="font-hand text-[30px] leading-none font-bold">
            Chrome extension
          </h2>
          <p className="max-w-[60ch] text-[15px] text-mute">Highlight a post (its words and its picture) on any website and click the Pen &amp; Paper icon: it lands on your latest paper with the page&apos;s address.</p>
          <span className="flex flex-wrap items-center gap-3">
            <a href="/downloads/penandpaper-chrome.zip" download className="inline-flex h-11 items-center rounded-xl border border-line bg-sheet px-4 text-sm font-semibold hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text">
              Download for Chrome
            </a>
            <Link href="/download" className="text-sm text-mute underline underline-offset-2 hover:text-ink">
              How to install
            </Link>
          </span>
        </section>

        <DesktopTokens />
      </main>
    </div>
  );
}

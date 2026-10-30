/**
 * The canvases a sheet can be drawn on. One entry per look; the paint itself is
 * CSS: globals.css has a `[data-canvas="<id>"]` block that sets that canvas's
 * tokens for the light and dark themes (`tokens` names them, so the settings
 * screen and the stylesheet can't drift apart unnoticed). To add a canvas: add
 * an entry here, then its CSS block, and nothing else.
 */
export const CANVASES = [
  {
    id: "dotted",
    label: "Dotted",
    hint: "Dots on a calm sheet",
    tokens: { light: ["--canvas-dotted-dot"], dark: ["--canvas-dotted-dot"] },
  },
  {
    id: "grid",
    label: "Grid",
    hint: "Squares, like graph paper",
    tokens: { light: ["--canvas-grid-line"], dark: ["--canvas-grid-line"] },
  },
  {
    id: "ruled",
    label: "Ruled",
    hint: "Thin notebook lines",
    tokens: {
      light: ["--canvas-ruled-bg", "--canvas-ruled-line"],
      dark: ["--canvas-ruled-bg", "--canvas-ruled-line"],
    },
  },
] as const;

export type CanvasId = (typeof CANVASES)[number]["id"];

export const CANVAS_IDS = CANVASES.map((c) => c.id) as [CanvasId, ...CanvasId[]];
export const DEFAULT_CANVAS: CanvasId = "dotted";

/**
 * How the thoughts are written. Only the notes change; headings stay handwritten.
 * "clean": Noto Sans, a calm neutral sans that covers Latin, Devanagari and
 * Telugu, so a mixed-language thought reads in one hand.
 */
export const NOTE_FONTS = [
  { id: "hand", label: "Handwritten", hint: "Like a pen on paper" },
  { id: "clean", label: "Clean", hint: "Neutral and easy to read" },
] as const;

export type NoteFont = (typeof NOTE_FONTS)[number]["id"];
export const NOTE_FONT_IDS = NOTE_FONTS.map((f) => f.id) as [NoteFont, ...NoteFont[]];
export const DEFAULT_NOTE_FONT: NoteFont = "hand";
export const NOTE_FONT_KEY = "pp-note-font";

export function parseNoteFont(value: unknown): NoteFont {
  return NOTE_FONT_IDS.find((id) => id === value) ?? DEFAULT_NOTE_FONT;
}

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const DEFAULT_THEME_MODE: ThemeMode = "system";

/** localStorage keys (the inline script in the root layout reads the same ones). */
export const CANVAS_KEY = "pp-canvas";
export const THEME_KEY = "pp-theme";

export function parseCanvas(value: unknown): CanvasId {
  return CANVAS_IDS.find((id) => id === value) ?? DEFAULT_CANVAS;
}

export function parseThemeMode(value: unknown): ThemeMode {
  return THEME_MODES.find((m) => m === value) ?? DEFAULT_THEME_MODE;
}

/** The theme to paint: an explicit choice, or the OS's when the mode is "system". */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}

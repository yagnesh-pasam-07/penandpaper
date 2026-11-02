# Theme: paper by day, a lamp at night

Pen and Paper has two themes that are the same brand under different light. Every colour is a named token in `src/app/globals.css` (`[data-theme="light"]` and `[data-theme="dark"]`), available in Tailwind as `bg-<name>`, `text-<name>`, `border-<name>`. **Components never use raw hex, `bg-white`, `text-black` or Tailwind's palette** (`gray-500` and the like). If a colour is missing, add a token for both themes.

## The rules

1. **Never pure white or pure black.** Light mode is warm off-white paper with warm near-black ink. Dark mode is warm charcoal with soft chalk text. Pure white glares; pure black halates.
2. **One hue family.** Every neutral has the same slight warm tint in both themes. No cold or blue greys.
3. **One accent: the red pen.** It's a touch deeper by day and softer by night, so it weighs the same. Use it sparingly: links, the main button, focus, a mark.
4. **Depth by layers.** `bg` (the page), `sheet` (cards), `raised` (menus, sheets, dialogs), `sunken` (wells). By day, paper lifts off paper: a quiet border plus `--lift` (a hairline and a long soft fall). At night, a lighter surface (`--lift` is `none`).
7. **Day is ivory, not beige.** Light paper is bright warm ivory with no grain (grain on light paper reads as dust); the homepage timeline is multiplied into the paper like faint print, each picture dissolving top and bottom.
5. **Dividers whisper; controls speak.** `line` separates content and is meant to be barely visible. `line-strong` outlines things you can type in or press (≥ 3:1).
6. **Dark text is not too bright.** Body text stays around 14:1. Night reading gets slightly more letter spacing and slightly less weight, and pictures are dimmed a touch.

## Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | `#faf8f4` | `#171614` | the page |
| `sheet` | `#fffdf9` | `#1f1d1a` | cards, panels |
| `raised` | `#fffefb` | `#292724` | menus, sheets, dialogs |
| `sunken` | `#f2efe8` | `#121110` | wells, code |
| `soft` | `#f3f0e9` | `#26241f` | hover, quiet fills |
| `ink` | `#1e1c19` | `#e9e4da` | text |
| `mute` | `#57534b` | `#b0aa9f` | secondary text |
| `graphite` | `#6a655c` | `#938d82` | dates, small print |
| `line` | `#ebe6dc` | `#312e2a` | dividers, card edges |
| `line-strong` | `#8a8478` | `#77716a` | input and control borders |
| `red-text` | `#b23a2c` | `#ec8a72` | accent text, links |
| `red` | `#b23a2c` | `#b8402f` | accent fill (buttons) |
| `on-red` | `#fffaf5` | `#fffaf5` | text on the accent |
| `red-soft` | `#f6e1db` | `#3a211c` | tinted badges |
| `brand-green` | `#1f7a4d` | `#237a4f` | WhatsApp / publish buttons |
| `highlight` | `#fbe7a6` | `#5a4a1e` | the marker pen |
| `selection` | `#f1d9c8` | `#4a2c24` | selected text |
| `green`, `amber` (+ `-soft`) | | | success, warning |

## Contrast (WCAG, measured)

| Pair | Light | Dark | Needs |
| --- | --- | --- | --- |
| `ink` on `bg` | 16.0 | 14.3 | ≥ 7 (dark ≤ 15) |
| `ink` on `sheet` | 16.7 | 13.3 | ≥ 7 |
| `mute` on `bg` | 7.2 | 7.8 | ≥ 4.5 |
| `graphite` on `bg` | 5.5 | 5.5 | ≥ 4.5 |
| `red-text` on `bg` | 5.6 | 7.3 | ≥ 4.5 |
| `on-red` on `red` | 5.7 | 5.3 | ≥ 4.5 |
| `on-red` on `brand-green` | 5.1 | 5.1 | ≥ 4.5 |
| `line-strong` on `bg` | 3.5 | 3.8 | ≥ 3 |

## Switching

The theme follows the system unless the person picks Light, Dark or System (Settings, or the moon/sun button), saved on the device and on the account. An inline script in `<head>` sets it before the first paint, so there is never a flash of the wrong theme. `color-scheme` matches each theme, so scrollbars and form controls follow. Switching fades colours in 150 ms (only while switching). The browser bar colour (`themeColor`) follows each theme.

## Exempt on purpose

Emails, share images (Open Graph, the Instagram card) and the Google/Microsoft logos keep fixed colours: they are pictures or other people's marks, not themed pages.

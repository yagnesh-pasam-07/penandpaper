// Draws the toolbar icons from the app's pen mark (src/app/icon.svg).
// Run once, from the repo root, when the mark changes:  node extension/make-icons.mjs
// Uses `sharp`, which Next.js already installs; the PNGs are committed, so
// loading the extension needs nothing built.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../src/app/icon.svg", import.meta.url));
for (const size of [16, 32, 48, 128]) {
  // A big render first, so the thin pen strokes stay smooth when shrunk.
  const png = await sharp(svg, { density: 600 }).resize(size, size).png().toBuffer();
  await writeFile(new URL(`./icons/${size}.png`, import.meta.url), png);
  console.log(`icons/${size}.png`);
}

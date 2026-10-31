// Makes Pen & Paper's signature sound: public/sounds/recall.wav.
// A soft pen tap on paper, then one warm, low bell note that fades out.
// Under 1.5 s, quiet, the same every day. Synthesised here (no samples), so
// it's ours. Run: node scripts/make-recall-sound.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 44100;
const LENGTH = 1.4;
const n = Math.floor(RATE * LENGTH);
const out = new Float32Array(n);

// A seeded random, so the paper's grain is the same every time the file is made.
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;

// 1. The tap: a few ms of filtered noise (paper), with a tiny knock under it.
let lp = 0;
for (let i = 0; i < RATE * 0.05; i++) {
  const t = i / RATE;
  lp += 0.35 * (rand() - lp);
  const env = Math.exp(-t * 140);
  out[i] += lp * env * 0.32 + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 90) * 0.18;
}

// 2. The bell: a soft fundamental with gently inharmonic partials, starting just after the tap.
const start = Math.floor(RATE * 0.045);
const notes = [
  { f: 659.25, a: 0.32, d: 3.2 }, // E5
  { f: 659.25 * 2.01, a: 0.09, d: 5.5 },
  { f: 659.25 * 2.76, a: 0.05, d: 7.5 },
  { f: 659.25 * 0.5, a: 0.07, d: 2.6 },
];
for (let i = start; i < n; i++) {
  const t = (i - start) / RATE;
  const attack = Math.min(1, t / 0.012);
  let v = 0;
  for (const p of notes) v += Math.sin(2 * Math.PI * p.f * t) * p.a * Math.exp(-t * p.d);
  out[i] += v * attack;
}

// Fade the very end to silence, and keep it quiet (peak about -9 dB).
let peak = 0;
for (let i = 0; i < n; i++) {
  const tail = Math.min(1, (n - i) / (RATE * 0.12));
  out[i] *= tail;
  peak = Math.max(peak, Math.abs(out[i]));
}
const gain = 0.35 / peak;

const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * gain)) * 32767), i * 2);
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
mkdirSync("public/sounds", { recursive: true });
writeFileSync("public/sounds/recall.wav", Buffer.concat([header, data]));
console.log(`public/sounds/recall.wav · ${LENGTH}s · ${Math.round((44 + data.length) / 1024)} KB`);

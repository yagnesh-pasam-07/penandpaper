"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { RecallSettings } from "./recall-server";
import { playRecallSound, pushIsOn, pushSupported, turnPushOff, turnPushOn } from "./recall-client";

const noSubscribe = () => () => {};
const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PRESETS = [
  { time: "07:00", label: "7 AM" },
  { time: "09:00", label: "9 AM" },
  { time: "13:00", label: "1 PM" },
  { time: "21:00", label: "9 PM" },
];

const PUSH_WORDS: Record<string, string> = {
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then try again.",
  unsupported: "This browser can't show notifications. On iPhone, add Pen & Paper to your Home Screen first.",
  not_configured: "Notifications aren't set up on this server yet.",
  failed: "Couldn't turn notifications on. Try again.",
};

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text ${on ? "bg-red" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-sheet shadow transition-transform motion-reduce:transition-none ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

/**
 * Settings for Thought of the Day: on or off, when it's ready (a time, or only
 * when you open the app), which days, the signature sound, and the daily
 * notification on this device.
 */
export function RecallSettingsSection() {
  const [s, setS] = useState<RecallSettings | null>(null);
  const [push, setPush] = useState<"on" | "off" | "busy">("off");
  const [pushNote, setPushNote] = useState("");
  const canPush = useSyncExternalStore(noSubscribe, pushSupported, () => false);

  useEffect(() => {
    void fetch("/api/drop/today?settings=1", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<RecallSettings>) : null))
      .then((d) => d && setS(d))
      .catch(() => {});
    void pushIsOn().then((on) => setPush(on ? "on" : "off"));
  }, []);

  const save = async (change: Partial<Omit<RecallSettings, "devices">>) => {
    if (!s) return;
    const before = s;
    setS({ ...s, ...change });
    const res = await fetch("/api/drop/today", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: change }) }).catch(() => null);
    if (res?.ok) setS((await res.json()) as RecallSettings);
    else setS(before);
  };

  const togglePush = async () => {
    setPushNote("");
    if (push === "on") {
      setPush("busy");
      await turnPushOff();
      setPush("off");
      setS((x) => (x ? { ...x, devices: Math.max(0, x.devices - 1) } : x));
      return;
    }
    setPush("busy");
    const r = await turnPushOn();
    if (r === "on") {
      setPush("on");
      setS((x) => (x ? { ...x, devices: x.devices + 1 } : x));
    } else {
      setPush("off");
      setPushNote(PUSH_WORDS[r]);
    }
  };

  if (!s) return null;
  const custom = s.time !== null && !PRESETS.some((p) => p.time === s.time);
  const chip = (on: boolean) => `h-9 rounded-lg px-3.5 text-sm font-medium ${on ? "bg-ink text-bg" : "text-mute hover:bg-soft hover:text-ink"}`;

  return (
    <section aria-labelledby="today-settings" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="today-settings" className="font-hand text-[30px] leading-none font-bold">
          Thought of the Day
        </h2>
        <p className="max-w-[60ch] text-[15px] text-mute">
          Once a day, one thought you wrote before comes back on a fresh paper, like a letter from your past self. Use it, or send it to tomorrow. One a day, one sound, never a list. On Sundays the evening email also links to your week&apos;s{" "}
          <Link href="/rewind" className="font-medium text-ink underline underline-offset-2">
            rewind
          </Link>
          .
        </p>
      </div>

      <label className="flex w-fit items-center gap-3 text-[15px]">
        <Switch on={s.on} onChange={() => void save({ on: !s.on })} label="Thought of the Day" />
        {s.on ? "On" : "Off"}
      </label>

      {s.on && (
        <>
          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-medium text-mute">When it&apos;s ready</span>
            <div role="radiogroup" aria-label="When it's ready" className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-xl border border-line bg-sheet p-1">
                {PRESETS.map((p) => (
                  <button key={p.time} type="button" role="radio" aria-checked={s.time === p.time} onClick={() => void save({ time: p.time })} className={chip(s.time === p.time)}>
                    {p.label}
                  </button>
                ))}
              </span>
              <label className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm ${custom ? "border-red-text bg-red-soft/40" : "border-line bg-sheet"}`}>
                <span className="text-mute">Other</span>
                <input
                  type="time"
                  value={s.time ?? ""}
                  onChange={(e) => e.target.value && void save({ time: e.target.value })}
                  className="bg-transparent font-medium text-ink outline-none"
                  aria-label="Pick a time"
                />
              </label>
              <button type="button" role="radio" aria-checked={s.time === null} onClick={() => void save({ time: null })} className={`h-11 rounded-xl border px-3.5 text-sm font-medium ${s.time === null ? "border-red-text bg-red-soft/40 text-ink" : "border-line bg-sheet text-mute hover:bg-soft hover:text-ink"}`}>
                Only when I open the app
              </button>
            </div>
            <span className="text-[13px] text-mute">
              {s.time === null ? "No notification: it greets you the first time you open your paper each day." : "It greets you the first time you open your paper after this time, and notifies the devices you turn on below."}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-medium text-mute">Days</span>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((d, i) => {
                const on = s.days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    aria-label={DAY_LABELS[i]}
                    onClick={() => {
                      const next = on ? s.days.filter((x) => x !== i) : [...s.days, i];
                      if (next.length) void save({ days: next });
                    }}
                    className={`size-10 rounded-full text-sm font-semibold ${on ? "bg-ink text-bg" : "border border-line bg-sheet text-mute hover:bg-soft"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 text-[15px]">
              <Switch on={s.sound} onChange={() => void save({ sound: !s.sound })} label="Signature sound" />
              Signature sound
            </label>
            <button type="button" onClick={playRecallSound} className="h-9 rounded-lg border border-line bg-sheet px-3 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
              ▶ Hear it
            </button>
            <span className="text-[13px] text-mute">A pen tap and one soft bell. The same every day.</span>
          </div>

          {s.time !== null && (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-sheet p-4 sm:max-w-[560px]">
              <div className="flex items-center justify-between gap-4">
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">Notify this device</span>
                  <span className="text-[13px] text-mute">
                    {s.devices === 0 ? "No devices yet." : `${s.devices} ${s.devices === 1 ? "device gets" : "devices get"} it.`} Open it on one and the others clear.
                  </span>
                </span>
                {canPush ? (
                  <Switch on={push === "on"} onChange={() => push !== "busy" && void togglePush()} label="Notify this device" />
                ) : (
                  <span className="text-[13px] text-mute">Not on this browser</span>
                )}
              </div>
              {pushNote && <p className="text-[13px] text-red-text">{pushNote}</p>}
              <p className="text-[12px] text-mute">
                Turn it on in each place you use Pen &amp; Paper: your computer&apos;s browser, and your phone (on iPhone, from the Home Screen app). With the paper open, the signature sound plays; when it&apos;s closed, your device plays its own notification sound.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

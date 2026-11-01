"use client";

import { useEffect, useRef, useState } from "react";
import { clock } from "./logic";

function PlayGlyph({ playing }: { playing: boolean }) {
  return playing ? (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2.5" y="2" width="3.2" height="10" rx="1" />
      <rect x="8.3" y="2" width="3.2" height="10" rx="1" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3.5 2.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L4.4 1.7a.6.6 0 0 0-.9.5Z" />
    </svg>
  );
}

/**
 * Listen: the writer's own recorded voice. A pill in the byline; once started,
 * a slim bar sticks to the bottom of the screen (play/pause, back 15 s,
 * forward 30 s, a scrubber), so you can keep reading along, or put the phone
 * in your pocket. Media Session puts the same controls on the lock screen, and
 * the audio keeps playing with the screen off.
 */
export function Listen({ src, title, author, artwork, duration }: { src: string; title: string; author: string; artwork: string | null; duration: number | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(duration ?? 0);

  // Lock-screen controls and the title on the lock screen.
  useEffect(() => {
    if (!open || !("mediaSession" in navigator)) return;
    const a = audio.current;
    if (!a) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: author, album: "Pen & Paper Stories", artwork: artwork ? [{ src: artwork, sizes: "480x480", type: "image/webp" }] : [] });
    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, fn);
      } catch {}
    };
    set("play", () => void a.play());
    set("pause", () => a.pause());
    set("seekbackward", (d) => (a.currentTime = Math.max(0, a.currentTime - (d.seekOffset ?? 15))));
    set("seekforward", (d) => (a.currentTime = Math.min(a.duration || Infinity, a.currentTime + (d.seekOffset ?? 30))));
    set("seekto", (d) => {
      if (d.seekTime != null) a.currentTime = d.seekTime;
    });
    return () => {
      for (const action of ["play", "pause", "seekbackward", "seekforward", "seekto"] as MediaSessionAction[]) set(action, null);
    };
  }, [open, title, author, artwork]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  };
  const start = () => {
    setOpen(true);
    // In the same tap, so iPhone allows it.
    void audio.current?.play().catch(() => {});
  };
  const skip = (s: number) => {
    const a = audio.current;
    if (a) a.currentTime = Math.min(Math.max(0, a.currentTime + s), a.duration || Infinity);
  };
  const progress = length ? Math.min(100, (time / length) * 100) : 0;

  return (
    <>
      {/* A real <audio>: iPhone keeps it playing with the screen locked. */}
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => {
          setPlaying(true);
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        }}
        onPause={() => {
          setPlaying(false);
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setTime(a.currentTime);
          if ("mediaSession" in navigator && a.duration && Number.isFinite(a.duration)) {
            try {
              navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: a.playbackRate });
            } catch {}
          }
        }}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLength(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <button
        id="listen"
        type="button"
        onClick={open ? toggle : start}
        aria-label={playing ? "Pause the story" : "Listen to the story"}
        className="flex h-10 items-center gap-2 rounded-full bg-ink pr-4 pl-3.5 text-[14px] font-semibold text-bg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text"
      >
        <PlayGlyph playing={playing} />
        {playing ? "Pause" : "Listen"}
        {length > 0 && !open && <span className="font-normal opacity-70">{clock(length)}</span>}
      </button>

      {open && (
        <div role="region" aria-label="Listening" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sheet/95 pb-[env(safe-area-inset-bottom)] font-sans backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[680px] items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => skip(-15)} aria-label="Back 15 seconds" className="flex size-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-mute hover:bg-soft hover:text-ink">
              −15
            </button>
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-bg">
              <PlayGlyph playing={playing} />
            </button>
            <button type="button" onClick={() => skip(30)} aria-label="Forward 30 seconds" className="flex size-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-mute hover:bg-soft hover:text-ink">
              +30
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-[13px] font-medium text-ink">{title}</span>
              <input
                type="range"
                min={0}
                max={length || 0}
                step={1}
                value={Math.min(time, length || 0)}
                onChange={(e) => {
                  if (audio.current) audio.current.currentTime = Number(e.target.value);
                }}
                aria-label="Where in the story"
                aria-valuetext={`${clock(time)} of ${clock(length)}`}
                className="story-scrub h-6 w-full"
                style={{ ["--p" as string]: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-[12px] text-mute tabular-nums">
              {clock(time)} / {clock(length)}
            </span>
            <button
              type="button"
              onClick={() => {
                audio.current?.pause();
                setOpen(false);
              }}
              aria-label="Close the player"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-mute hover:bg-soft hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { TAB_ID } from "./chrome";
import { CURSOR_EVERY_MS, CURSOR_IDLE_MS, PEER_TIMEOUT_MS, type LiveEvent, type Peer } from "./live";

/** Someone else with this paper open, and where they're pointing (a saved spot), if anywhere. */
export type LivePeer = Peer & { seen: number; at: { x: number; y: number } | null; movedAt: number };

export type LiveState = {
  /** The stream is open: changes arrive as they're saved. */
  connected: boolean;
  /** Everyone else here now, one per tab, oldest first. */
  peers: LivePeer[];
  /** Taken off the paper (the owner stopped sharing, or turned the link off). */
  removed: boolean;
};

/**
 * Keeps a paper live. `onChange` gets each change someone else saved (fold it in
 * with `applyLive`); `onSync` is asked to fetch the whole paper (after a
 * reconnect, or a change too big to send). `spot` is where this tab's pointer
 * is on the paper (a saved spot), sent to the others while it moves.
 */
export function useLive(
  paperId: string,
  {
    token,
    spot,
    onChange,
    onSync,
    onRole,
  }: {
    token?: string | null;
    spot?: MutableRefObject<{ x: number; y: number } | null>;
    onChange: (ev: LiveEvent) => void;
    onSync: () => void;
    /** Their role on the paper changed (made an editor, or view only): the page should reload. */
    onRole?: () => void;
  },
): LiveState {
  const [connected, setConnected] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [peers, setPeers] = useState<Map<string, LivePeer>>(new Map());
  const key = useRef<string | null>(null);
  // Anyone else here: pointer moves are only sent when someone could see them.
  const company = useRef(false);
  useEffect(() => {
    company.current = peers.size > 0;
  }, [peers]);
  const handlers = useRef({ onChange, onSync, onRole });
  useEffect(() => {
    handlers.current = { onChange, onSync, onRole };
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let opened = 0;
    let stopped = false;
    const url = `/api/drop/papers/${paperId}/live?tab=${TAB_ID}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
    const see = (p: Peer, change: Partial<LivePeer> = {}) =>
      setPeers((m) => {
        const before = m.get(p.sid);
        return new Map(m).set(p.sid, { at: null, movedAt: 0, ...before, ...p, seen: Date.now(), ...change });
      });

    const open = () => {
      if (stopped) return;
      source = new EventSource(url);
      source.addEventListener("hello", (e) => {
        const { key: k } = JSON.parse((e as MessageEvent).data) as { key: string };
        key.current = k;
        setConnected(true);
        // Back after a gap: whatever was missed comes in one read.
        if (opened++ > 0) handlers.current.onSync();
      });
      source.addEventListener("live", (e) => {
        const ev = JSON.parse((e as MessageEvent).data) as LiveEvent;
        if (ev.type === "join" || ev.type === "here") see(ev.peer);
        else if (ev.type === "leave")
          setPeers((m) => {
            if (!m.has(ev.sid)) return m;
            const next = new Map(m);
            next.delete(ev.sid);
            return next;
          });
        else if (ev.type === "cursor")
          setPeers((m) => {
            const p = m.get(ev.sid);
            // A cursor from someone not seen yet waits for their "here" (at most 20 s).
            return p ? new Map(m).set(ev.sid, { ...p, at: ev.at, seen: Date.now(), movedAt: Date.now() }) : m;
          });
        else if (ev.type === "sync") handlers.current.onSync();
        else handlers.current.onChange(ev);
      });
      source.addEventListener("bye", (e) => {
        const { why } = JSON.parse((e as MessageEvent).data) as { why: string };
        if (why === "removed") {
          stopped = true;
          source?.close();
          setConnected(false);
          setRemoved(true);
        } else if (why === "role") {
          stopped = true;
          source?.close();
          handlers.current.onRole?.();
        }
        // "renew" / "lost": the browser reconnects by itself.
      });
      source.onerror = () => {
        setConnected(false);
        // A 404 (no longer shared, or gone) closes it for good; otherwise EventSource retries on its own.
        if (source?.readyState === EventSource.CLOSED && !stopped) {
          source = null;
          setTimeout(() => !source && open(), 5000);
        }
      };
    };
    open();

    // People who went quiet (a closed laptop) leave the row of faces.
    const prune = setInterval(
      () =>
        setPeers((m) => {
          const now = Date.now();
          const stale = [...m.values()].filter((p) => now - p.seen > PEER_TIMEOUT_MS);
          if (!stale.length) return m;
          const next = new Map(m);
          stale.forEach((p) => next.delete(p.sid));
          return next;
        }),
      10_000,
    );

    // A tab left in the background lets go of the paper after a minute (an open stream keeps the database awake),
    // and picks it up again, with everything it missed, when it's looked at.
    let idle: ReturnType<typeof setTimeout> | null = null;
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        idle = setTimeout(() => {
          source?.close();
          source = null;
          setConnected(false);
          setPeers(new Map());
        }, 60_000);
      } else {
        if (idle) clearTimeout(idle);
        idle = null;
        if (!source && !stopped) {
          opened = Math.max(opened, 1);
          open();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const bye = () => {
      if (key.current) navigator.sendBeacon?.(`/api/drop/papers/${paperId}/live`, new Blob([JSON.stringify({ key: key.current, leave: true })], { type: "application/json" }));
    };
    window.addEventListener("pagehide", bye);
    return () => {
      stopped = true;
      source?.close();
      clearInterval(prune);
      if (idle) clearTimeout(idle);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", bye);
      bye();
    };
  }, [paperId, token]);

  // Where this tab is pointing, at most every CURSOR_EVERY_MS, only while it moves (and once when it leaves).
  useEffect(() => {
    if (!spot) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = "";
    const flush = () => {
      timer = null;
      const k = key.current;
      if (!k || !company.current || document.visibilityState !== "visible") return;
      const at = spot.current ? { x: Math.round(spot.current.x * 10000) / 10000, y: Math.round(spot.current.y) } : null;
      const body = JSON.stringify({ key: k, at });
      if (body === last) return;
      last = body;
      void fetch(`/api/drop/papers/${paperId}/live`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    };
    const moved = () => {
      if (!timer) timer = setTimeout(flush, CURSOR_EVERY_MS);
    };
    // After the sheet has read the pointer (its own listener runs first).
    const onMove = () => queueMicrotask(moved);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("mouseleave", moved);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", moved);
      if (timer) clearTimeout(timer);
    };
  }, [paperId, spot]);

  return { connected, peers: [...peers.values()].sort((a, b) => a.sid.localeCompare(b.sid)), removed };
}

/** Whether a peer's cursor should show: they've pointed somewhere on the paper lately. */
export const cursorShows = (p: LivePeer, now: number) => !!p.at && now - p.movedAt < CURSOR_IDLE_MS;

import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { z } from "zod";
import { uid } from "@/lib/mutations";
import { channelOf, inkFor, type Envelope, type Peer } from "@/modules/drop/live";
import { accessTo, broadcast, firstName, listenUrl, liveKey, readKey } from "@/modules/drop/live-server";
import { currentUser } from "@/server/session";

if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

/** A stream lives this long, then closes; the browser reconnects at once (and re-checks access). */
export const maxDuration = 300;
const LIFE_MS = 270_000;
const HERE_MS = 20_000;

const gone = () => Response.json({ error: "That paper isn't there." }, { status: 404 });

/**
 * The paper, live (server-sent events): every change saved on it by anyone,
 * who else has it open, and where they're pointing. The owner and people it's
 * shared with (signed in), or anyone with the public link while it's on (`?t=`).
 * Access is checked when the stream opens, again whenever sharing changes, and
 * the stream is renewed every few minutes.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/drop/papers/[id]/live">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return gone();
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  // The tab's own id (it sends the same one with each save), so its changes don't come back to it.
  const tab = url.searchParams.get("tab");
  const user = await currentUser().catch(() => null);
  const access = await accessTo(id, user, token);
  if (!access) return gone();

  const sid = tab && /^[a-z0-9-]{6,40}$/.test(tab) ? tab : uid();
  const peer: Peer = user
    ? { sid, uid: user.id, name: await firstName(user.id), ink: inkFor(user.id), role: access.role }
    : { sid, uid: `guest-${sid}`, name: "Guest", ink: inkFor(sid), role: "view" };
  const owner = access.role === "owner";

  const db = new Client({ connectionString: listenUrl() });
  const encoder = new TextEncoder();
  let closed = false;
  const timers: ReturnType<typeof setInterval>[] = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      const send = (event: string, data: unknown) => {
        if (!closed) out.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = async (why?: string) => {
        if (closed) return;
        if (why) send("bye", { why });
        closed = true;
        timers.forEach(clearInterval);
        try {
          out.close();
        } catch {}
        await broadcast(id, { type: "leave", sid }, sid);
        await db.end().catch(() => {});
      };
      request.signal.addEventListener("abort", () => void close());

      try {
        await db.connect();
        db.on("error", () => void close("lost"));
        db.on("notification", (n) => {
          if (!n.payload) return;
          let ev: Envelope;
          try {
            ev = JSON.parse(n.payload) as Envelope;
          } catch {
            return;
          }
          if (ev.by === sid) return;
          if (ev.type === "access") {
            // Someone was added, removed or changed: if it might be them, look again.
            if (!owner && (!user || ev.email === user.email.toLowerCase() || ev.email === "*")) {
              void accessTo(id, user, token).then((now) => {
                if (!now) void close("removed");
                else if (now.role !== peer.role) void close("role");
              });
            }
            return;
          }
          // Due dates are the owner's own planning.
          if (ev.type === "thought" && !owner) ev = { ...ev, thought: { ...ev.thought, dueAt: null, dueHasTime: false } };
          send("live", ev);
        });
        await db.query(`LISTEN "${channelOf(id)}"`);
      } catch (e) {
        console.error("live: listen failed", e);
        send("bye", { why: "lost" });
        closed = true;
        out.close();
        await db.end().catch(() => {});
        return;
      }

      // Tell the browser who it is (and its key for pointer moves), then everyone else that it's here.
      out.enqueue(encoder.encode("retry: 1500\n\n"));
      send("hello", { peer, key: liveKey(id, peer) });
      await broadcast(id, { type: "join", peer }, sid);
      timers.push(
        setInterval(() => {
          send("ping", {});
          void broadcast(id, { type: "here", peer }, sid);
        }, HERE_MS),
      );
      timers.push(setInterval(() => void close("renew"), LIFE_MS));
    },
    cancel() {
      closed = true;
      timers.forEach(clearInterval);
      void broadcast(id, { type: "leave", sid }, sid);
      void db.end().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

const move = z.object({
  key: z.string().max(2000),
  /** A saved spot (x a share of the column, y px), or null when the pointer left the paper. */
  at: z.object({ x: z.number().finite().min(-200).max(200), y: z.number().finite().min(-200_000).max(200_000) }).nullable().optional(),
  /** "I'm here" / "I'm leaving", for a tab that's going away before its stream notices. */
  leave: z.literal(true).optional(),
});

/** Where this tab is pointing (or that it's leaving). Checked by the stream's key, not a database read. */
export async function POST(request: Request, ctx: RouteContext<"/api/drop/papers/[id]/live">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return gone();
  const parsed = move.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Not a move." }, { status: 400 });
  const peer = readKey(id, parsed.data.key);
  if (!peer) return Response.json({ error: "Reconnect." }, { status: 401 });
  if (parsed.data.leave) await broadcast(id, { type: "leave", sid: peer.sid }, peer.sid);
  else await broadcast(id, { type: "cursor", sid: peer.sid, at: parsed.data.at ?? null }, peer.sid);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

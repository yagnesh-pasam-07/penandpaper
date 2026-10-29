"use client";

import { useCallback, useEffect, useState } from "react";
import { call } from "./chrome";
import { MAX_ACTIVE_TOKENS, MAX_TOKEN_NAME } from "./tokens";

type Token = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never");

/** Settings → Desktop app: the keys the Mac menu-bar app saves with. A new secret is shown once. */
export function DesktopTokens() {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("Mac app");
  const [fresh, setFresh] = useState<{ secret: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTokens((await call<{ tokens: Token[] }>("/api/drop/tokens")).tokens);
    } catch (e) {
      setTokens([]);
      setError(e instanceof Error ? e.message : "Couldn't load your tokens.");
    }
  }, []);

  useEffect(() => {
    let live = true;
    call<{ tokens: Token[] }>("/api/drop/tokens")
      .then((r) => live && setTokens(r.tokens))
      .catch((e) => {
        if (!live) return;
        setTokens([]);
        setError(e instanceof Error ? e.message : "Couldn't load your tokens.");
      });
    return () => {
      live = false;
    };
  }, []);

  const active = (tokens ?? []).filter((t) => !t.revokedAt).length;

  async function create() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const made = await call<{ secret: string; token: Token }>("/api/drop/tokens", { method: "POST", body: JSON.stringify({ name }) });
      setFresh({ secret: made.secret, name: made.token.name });
      setCopied(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make a token.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError("");
    try {
      await call(`/api/drop/tokens/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't revoke that token.");
    }
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.secret);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the token and copy it by hand.");
    }
  }

  return (
    <section aria-labelledby="desktop" className="flex flex-col gap-4">
      <h2 id="desktop" className="font-hand text-[30px] leading-none font-bold">
        Desktop app
      </h2>
      <p className="max-w-[60ch] text-[15px] text-mute">
        A Mac menu-bar app is coming: press a key in any app and your words land on your latest paper. It signs in with a token, not your password. Make one here and paste it into the app when it asks.
      </p>

      {fresh && (
        <div role="status" className="flex max-w-[560px] flex-col gap-2 rounded-2xl border border-red-text/50 bg-red-soft/40 p-4">
          <span className="text-sm font-semibold">&ldquo;{fresh.name}&rdquo; is ready. Copy it now: it won&apos;t be shown again.</span>
          <code className="rounded-lg border border-line bg-sheet px-3 py-2 font-mono text-[13px] break-all select-all">{fresh.secret}</code>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void copy()} className="h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-bg">
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={() => setFresh(null)} className="h-9 rounded-lg px-3 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
              Done
            </button>
          </div>
        </div>
      )}

      {tokens && tokens.length > 0 && (
        <ul className="flex max-w-[560px] flex-col divide-y divide-line rounded-2xl border border-line bg-sheet">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-col">
                <span className={`truncate text-sm font-semibold ${t.revokedAt ? "text-mute line-through" : ""}`}>{t.name}</span>
                <span className="truncate font-mono text-[12px] text-mute">
                  {t.prefix}… · made {when(t.createdAt)} · {t.revokedAt ? `revoked ${when(t.revokedAt)}` : `last used ${when(t.lastUsedAt)}`}
                </span>
              </span>
              {!t.revokedAt && (
                <button type="button" onClick={() => void revoke(t.id)} className="h-9 shrink-0 rounded-lg px-3 text-sm font-medium text-red-text hover:bg-red-soft/50">
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex max-w-[560px] flex-wrap items-end gap-2">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="text-[13px] font-medium text-mute">Name</span>
          <input
            value={name}
            maxLength={MAX_TOKEN_NAME}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-lg border border-line bg-sheet px-3 text-sm outline-none focus:border-red-text"
          />
        </label>
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy || !name.trim() || active >= MAX_ACTIVE_TOKENS}
          className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-bg disabled:opacity-40"
        >
          Create token
        </button>
      </div>
      {active >= MAX_ACTIVE_TOKENS && <p className="text-[13px] text-mute">You have {MAX_ACTIVE_TOKENS} active tokens. Revoke one to make another.</p>}
      {error && (
        <p role="alert" className="text-[13px] text-red-text">
          {error}
        </p>
      )}
    </section>
  );
}

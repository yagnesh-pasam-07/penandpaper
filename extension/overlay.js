// The quick-thought box and the little "Saved" note, drawn on top of the page
// you are on. The background worker injects this file (it is a plain script,
// not a module) and then calls window.__ppQuick.toggle() or .toast(). It lives
// in a closed shadow root, so the page's own styles can't change it and its
// scripts can't reach in. Saving is done by the background worker (it has the
// permission to talk to the site and keeps the outbox); this file draws, keeps
// the draft, and asks.
//
// It opens with no network call: the paper's name, the last "attach this page"
// choice and any unsent draft come from chrome.storage.local, which is on this
// device.
(() => {
  if (window.__ppQuick) return;

  const MAX_THOUGHT = 1000;
  const SHOW_COUNT_FROM = 900;
  const TOAST_MS = 2600;
  const UNDO_MS = 5000;
  const HINT = "Enter saves · Shift+Enter new line · Esc closes";

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .root {
      --bg: #faf8f3; --sheet: #ffffff; --ink: #1d1c1a; --mute: #6d6a63; --line: #e6e1d7; --red: #c0392b; --shadow: rgb(29 28 26 / 0.45);
      font: 15px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink);
    }
    @media (prefers-color-scheme: dark) {
      .root { --bg: #151412; --sheet: #1e1d1a; --ink: #ece9e2; --mute: #a29e94; --line: #34312c; --red: #e07a6b; --shadow: rgb(0 0 0 / 0.65); }
    }
    .backdrop {
      position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: flex-start; justify-content: center;
      padding: 18vh 16px 16px; background: rgb(20 19 17 / 0.38);
    }
    .card {
      width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 10px; padding: 16px;
      background: var(--bg); border: 1px solid var(--line); border-radius: 20px; box-shadow: 0 30px 70px -24px var(--shadow);
    }
    .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 0 2px; }
    .title { font: 700 26px/1 "Kalam", "Caveat", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive; }
    .where { color: var(--mute); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    textarea {
      display: block; width: 100%; height: 66px; min-height: 66px; max-height: 190px; resize: none; padding: 12px 14px; color: var(--ink);
      background: var(--sheet); border: 1px solid var(--line); border-radius: 14px; outline: none;
      font: 400 20px/1.35 "Kalam", "Caveat", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
    }
    textarea::placeholder { color: var(--mute); }
    textarea:focus-visible { border-color: var(--red); box-shadow: 0 0 0 2px var(--red); }
    .opts { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 2px; min-height: 22px; }
    label.attach { display: inline-flex; align-items: center; gap: 8px; color: var(--mute); font-size: 13px; cursor: pointer; }
    input[type="checkbox"] { width: 16px; height: 16px; margin: 0; accent-color: var(--red); }
    input[type="checkbox"]:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
    .count { color: var(--mute); font-size: 12px; font-variant-numeric: tabular-nums; }
    .count.near { color: var(--red); }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 2px; }
    .hint { min-height: 18px; margin: 0; color: var(--mute); font-size: 13px; }
    .hint.error { color: var(--red); }
    button {
      font: 600 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif; height: 34px; padding: 0 16px; border: 0; border-radius: 10px;
      background: var(--ink); color: var(--bg); cursor: pointer;
    }
    button:disabled { opacity: 0.4; cursor: default; }
    button:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
    .toast {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: calc(100vw - 32px);
      display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--ink); color: var(--bg); border-radius: 999px;
      box-shadow: 0 14px 34px -14px var(--shadow); font: 600 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .toast.error { background: var(--red); color: #fff; }
    .toast button { height: 26px; padding: 0 10px; border-radius: 8px; background: transparent; color: inherit; border: 1px solid currentColor; font-size: 13px; }
    .toast button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    @media (prefers-reduced-motion: no-preference) {
      .card { animation: rise 120ms ease-out; }
      .toast { animation: pop 120ms ease-out; }
      @keyframes rise { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
      @keyframes pop { from { opacity: 0; transform: translateX(-50%) translateY(6px); } }
    }
  `;

  let host = null;
  let toastHost = null;
  let toastTimer = 0;

  const newId = () => `ext-${crypto.randomUUID()}`.slice(0, 40);

  function make(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    for (const k of kids) el.append(k);
    return el;
  }

  function styled(shadow) {
    shadow.append(make("style", { textContent: css }));
    return make("div", { className: "root" });
  }

  const store = {
    async get(keys) {
      try {
        return await chrome.storage.local.get(keys);
      } catch {
        return {};
      }
    },
    async set(values) {
      try {
        await chrome.storage.local.set(values);
      } catch {
        // The extension was reloaded since this page loaded; nothing to keep it in.
      }
    },
  };

  function close() {
    if (!host) return;
    host.remove();
    host = null;
    window.removeEventListener("pagehide", close);
  }

  function open() {
    if (host) return;
    const previous = document.activeElement;
    host = document.createElement("div");
    host.setAttribute("data-pp-quick", "");
    const shadow = host.attachShadow({ mode: "closed" });
    const root = styled(shadow);

    const textarea = make("textarea", { rows: 2, maxLength: MAX_THOUGHT, placeholder: "What's on your mind?" });
    textarea.setAttribute("aria-label", "Your thought");
    const title = make("span", { className: "title", id: "pp-title", textContent: "Quick thought" });
    const where = make("span", { className: "where", textContent: "to your latest paper" });
    const attach = make("input", { type: "checkbox", id: "pp-attach" });
    const attachLabel = make("label", { className: "attach", htmlFor: "pp-attach" }, attach, "Attach this page");
    const count = make("span", { className: "count" });
    const hint = make("p", { className: "hint", textContent: HINT });
    hint.setAttribute("role", "status");
    const save = make("button", { type: "button", textContent: "Save", disabled: true });
    const card = make(
      "div",
      { className: "card" },
      make("div", { className: "head" }, title, where),
      textarea,
      make("div", { className: "opts" }, attachLabel, count),
      make("div", { className: "foot" }, hint, save),
    );
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "pp-title");
    const backdrop = make("div", { className: "backdrop" }, card);
    root.append(backdrop);
    shadow.append(root);

    const grow = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 66), 190)}px`;
    };
    const refresh = () => {
      const n = textarea.value.length;
      save.disabled = !textarea.value.trim();
      count.textContent = n >= SHOW_COUNT_FROM ? `${n}/${MAX_THOUGHT}` : "";
      count.className = n >= MAX_THOUGHT - 20 ? "count near" : "count";
    };
    const say = (message, error = false) => {
      hint.textContent = message;
      hint.className = error ? "hint error" : "hint";
    };

    const finish = () => {
      // An unsent thought is kept for the next time; a sent one has already cleared it.
      void store.set({ draft: textarea.value.trim() ? textarea.value : "" });
      close();
      if (previous && typeof previous.focus === "function") previous.focus();
    };
    host.finish = finish;

    function submit() {
      const text = textarea.value.trim();
      if (!text) return;
      const withPage = attach.checked;
      const id = newId();
      const page = withPage ? { title: document.title, url: location.href } : null;
      // Gone at once: the worker keeps the thought safe and says how it went.
      textarea.value = "";
      void store.set({ draft: "", attach: withPage });
      finish();
      void send(id, text, page);
    }

    textarea.addEventListener("input", () => {
      grow();
      refresh();
      if (hint.className.includes("error")) say(HINT);
    });
    save.addEventListener("click", submit);
    backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === backdrop) finish();
    });

    // Keys typed in the box stay in the box: the page's own shortcuts (a video
    // player's space bar, a mail app's single letters) must not see them. A page
    // that listens in the capture phase on window can still see them first.
    card.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "Enter" && (!e.shiftKey || e.metaKey || e.ctrlKey) && e.target === textarea) {
        e.preventDefault();
        submit();
      } else if (e.key === "Tab") {
        // A real focus trap: Tab and Shift+Tab go round the box's own controls.
        const stops = [textarea, attach, save].filter((el) => !el.disabled);
        const at = stops.indexOf(shadow.activeElement);
        const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : at === stops.length - 1 ? 0 : at + 1;
        e.preventDefault();
        stops[next].focus();
      }
    });
    for (const type of ["keyup", "keypress"]) card.addEventListener(type, (e) => e.stopPropagation());

    window.addEventListener("pagehide", close);
    document.documentElement.append(host);
    // Same frame as it appears: no waiting for anything.
    textarea.focus();
    refresh();

    // Then what is on this device: the paper's name, the last choice, an unsent draft.
    void store.get(["paper", "attach", "draft"]).then(({ paper, attach: wasOn, draft }) => {
      if (!host) return;
      if (paper?.name) where.textContent = `to “${paper.name}”`;
      attach.checked = wasOn === true;
      if (typeof draft === "string" && draft && !textarea.value) {
        textarea.value = draft.slice(0, MAX_THOUGHT);
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        grow();
        refresh();
      }
    });
  }

  /** Hands a thought to the worker and says how it went, in the note at the bottom of the page. */
  async function send(id, text, page) {
    toast("Saving…");
    try {
      const out = await chrome.runtime.sendMessage({ type: "pp:capture", id, text, page });
      if (out?.kind === "saved") toast(out.message, "ok", { id, paperId: out.paperId });
      else if (out?.kind === "queued") toast(out.message, "ok");
      else toast(out?.message || "Couldn't save that.", "error");
    } catch {
      // The extension was updated or reloaded since this page loaded: keep the words for the next open.
      await store.set({ draft: text });
      toast("The extension was updated. Reload this page; your words are kept as a draft.", "error");
    }
  }

  /** The note at the bottom of the page. `undo` ({ id, paperId }) adds an Undo button for a few seconds. */
  function toast(message, tone = "ok", undo = null) {
    clearTimeout(toastTimer);
    toastHost?.remove();
    toastHost = document.createElement("div");
    toastHost.setAttribute("data-pp-toast", "");
    const shadow = toastHost.attachShadow({ mode: "closed" });
    const root = styled(shadow);
    const note = make("div", { className: tone === "error" ? "toast error" : "toast" }, make("span", { textContent: String(message ?? "") }));
    note.setAttribute("role", "status");
    if (undo) {
      const button = make("button", { type: "button", textContent: "Undo" });
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const out = await chrome.runtime.sendMessage({ type: "pp:undo", id: undo.id, paperId: undo.paperId });
          toast(out?.ok ? "Undone" : out?.message || "Couldn't undo that.", out?.ok ? "ok" : "error");
        } catch {
          toast("Couldn't undo that.", "error");
        }
      });
      note.append(button);
    }
    root.append(note);
    shadow.append(root);
    document.documentElement.append(toastHost);
    toastTimer = setTimeout(
      () => {
        toastHost?.remove();
        toastHost = null;
      },
      undo ? UNDO_MS : TOAST_MS,
    );
  }

  window.__ppQuick = {
    toggle() {
      if (host) (host.finish ?? close)();
      else open();
    },
    toast,
  };
})();

"use client";

import { useActionState } from "react";
import { importFromMedium } from "./actions";

/** One field: a Medium post's address. It comes in as a draft, pictures and all. */
export function ImportForm() {
  const [state, action, pending] = useActionState(importFromMedium, { error: "" });
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-dashed border-line p-5">
      <label htmlFor="medium-url" className="text-[15px] font-medium">
        Bring a story from Medium
      </label>
      <div className="flex gap-2 max-sm:flex-col">
        <input id="medium-url" name="url" type="url" required placeholder="https://medium.com/@you/your-story-…" className="h-11 flex-1 rounded-xl border border-line bg-sheet px-3.5 text-[15px] outline-none focus:border-ink" />
        <button type="submit" disabled={pending} className="h-11 rounded-xl border border-ink px-5 text-[15px] font-semibold disabled:opacity-60">
          {pending ? "Bringing it in…" : "Import as a draft"}
        </button>
      </div>
      {state.error ? <p className="text-[13px] text-red-text">{state.error}</p> : <p className="text-[13px] text-mute">The words, every picture and its caption are copied here, with “First published on Medium” at the end.</p>}
    </form>
  );
}

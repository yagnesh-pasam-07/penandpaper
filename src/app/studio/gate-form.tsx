"use client";

import { useActionState } from "react";
import { btn } from "@/components/btn";
import { enter } from "./actions";

/** One field, one button. The code is typed, never shown in the address bar. */
export function GateForm() {
  const [state, action, pending] = useActionState(enter, { error: "" });
  return (
    <form action={action} className="flex w-full max-w-[320px] flex-col gap-3">
      <label htmlFor="code" className="sr-only">
        Passcode
      </label>
      <input
        id="code"
        name="code"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        required
        placeholder="Passcode"
        aria-invalid={!!state.error}
        aria-describedby="code-error"
        className="h-[52px] w-full rounded-[14px] border-[1.5px] border-ink bg-sheet px-4 text-center text-[18px] tracking-[0.2em] outline-none placeholder:tracking-normal placeholder:text-mute"
      />
      <button type="submit" disabled={pending} className={`${btn.primarySm} w-full`}>
        {pending ? "Checking…" : "Open"}
      </button>
      <p id="code-error" role="alert" className="min-h-5 text-center text-[13px] text-red-text">
        {state.error}
      </p>
    </form>
  );
}

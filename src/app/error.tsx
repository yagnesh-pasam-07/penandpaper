"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      <span className="font-hand text-5xl font-bold">The ink smudged.</span>
      <span className="text-mute">Something went wrong on our side. Your work is saved.</span>
      <button type="button" onClick={reset} className="inline-flex h-12 items-center rounded-xl bg-red px-[22px] font-semibold text-on-red">
        Try again
      </button>
    </div>
  );
}

import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      <span className="font-hand text-5xl font-bold">This page is a blank sheet.</span>
      <span className="text-mute">The link may be old, or the page moved.</span>
      <Link href="/" className="inline-flex h-12 items-center rounded-xl bg-red px-[22px] font-semibold text-on-red">
        Back to Pen &amp; Paper
      </Link>
    </div>
  );
}

/**
 * The idea behind the product, in two steps: first we put thoughts down on
 * paper; Pen & Paper is the same pen and paper, digitally, and better at the
 * part paper was always bad at (finding it, keeping it, getting it back).
 */
const PAPER = ["Write anywhere on the page", "Draw an arrow from one idea to the next", "Tape in a picture"];
const DIGITAL = ["Click anywhere and write, or hold Space and say it", "Draw a line between two thoughts: they stay tied", "Paste a screenshot, a link, a video"];
const BETTER = ["Find any word on any paper", "Close the day in a minute", "Thoughts come back when they matter"];

export function TwoWays() {
  return (
    <section aria-labelledby="two-ways-title" className="mx-auto flex w-full max-w-[1040px] flex-col items-center gap-12 px-4 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 id="two-ways-title" className="font-hand text-[44px] leading-none font-bold sm:text-[64px]">
          First, on paper.
          <br />
          <span className="highlight">Now, pen &amp; paper, digitally.</span>
        </h2>
        <p className="max-w-[560px] text-[17px] leading-normal text-mute sm:text-[19px]">
          The best place to think was always a pen and a sheet of paper. We kept the freedom and fixed what paper loses: the page you can&apos;t find, the note you never read again.
        </p>
      </div>

      <ol className="grid w-full gap-5 sm:grid-cols-2">
        <li className="flex flex-col gap-4 rounded-[22px] border border-line bg-sheet p-6 sm:p-8">
          <span className="font-mono text-[12px] tracking-wide text-mute uppercase">1 · On paper</span>
          <ul className="flex flex-col gap-2.5 font-hand text-[24px] leading-snug sm:text-[26px]">
            {PAPER.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mt-auto text-[15px] text-mute">
            <del className="decoration-red-text decoration-2">Then the page gets lost.</del>
          </p>
        </li>
        <li className="flex flex-col gap-4 rounded-[22px] border border-red-text/40 bg-sheet p-6 shadow-[0_18px_40px_-28px_var(--shadow)] sm:p-8">
          <span className="font-mono text-[12px] tracking-wide text-red-text uppercase">2 · Pen &amp; Paper, digitally</span>
          <ul className="flex flex-col gap-2.5 font-hand text-[24px] leading-snug sm:text-[26px]">
            {DIGITAL.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <ul className="mt-auto flex flex-wrap gap-2">
            {BETTER.map((t) => (
              <li key={t} className="rounded-full bg-red-soft px-3 py-1 text-[13px] font-medium text-red-text">
                {t}
              </li>
            ))}
          </ul>
        </li>
      </ol>
    </section>
  );
}

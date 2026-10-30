"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { btn } from "@/components/btn";
import { Keys } from "@/components/keys";
import { usePlatform } from "@/lib/platform";
import { promptInstall, useCanInstall } from "@/lib/install";
import { Glyph } from "@/screens/home/glyph";

/** Built by scripts/build-downloads.sh into public/downloads/. */
const CHROME_ZIP = "/downloads/penandpaper-chrome.zip";
const MAC_ZIP = "/downloads/PenAndPaper-mac.zip";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";
const code = "font-mono text-[13px] text-ink";

/** One thing to download: what it does, the button, who it's for, and how to set it up. */
function Card({ kind, title, blurb, button, under, steps, note }: { kind: "mac" | "chrome" | "web"; title: string; blurb: string; button: ReactNode; under?: string; steps: ReactNode[]; note?: ReactNode }) {
  const id = `${kind}-title`;
  return (
    <section aria-labelledby={id} className="flex scroll-mt-20 flex-col gap-5 rounded-2xl border border-line bg-sheet p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <Glyph kind={kind} />
        <h2 id={id} className="font-hand text-[34px] leading-none font-bold">
          {title}
        </h2>
      </div>
      <p className="text-[16px] text-mute">{blurb}</p>
      <div className="flex flex-col gap-1.5">
        {button}
        {under && <span className="text-[13px] text-mute">{under}</span>}
      </div>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-mute marker:text-mute/70">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {note && <p className="border-t border-line pt-4 text-[13px] text-mute">{note}</p>}
    </section>
  );
}

function ChromeCard({ windows }: { windows: boolean }) {
  return (
    <Card
      kind="chrome"
      title="Chrome extension"
      blurb="Highlight a post (its words and its picture) and click the Pen & Paper icon. It lands on your latest paper with the page's address."
      button={
        <a href={CHROME_ZIP} download="penandpaper-chrome.zip" className={`${btn.primarySm} self-start ${focus}`}>
          Download for Chrome &amp; Edge
        </a>
      }
      under="Windows, Mac and Linux"
      steps={[
        windows ? (
          <>
            Right-click the zip → <b className="text-ink">Extract All</b>. Chrome needs the unzipped folder.
          </>
        ) : (
          <>
            Unzip the download. <span className="text-mute/80">(On Windows: right-click it → Extract All.)</span>
          </>
        ),
        <>
          Open <code className={code}>chrome://extensions</code> (Edge: <code className={code}>edge://extensions</code>) and turn on <b className="text-ink">Developer mode</b>.
        </>,
        <>
          Click <b className="text-ink">Load unpacked</b> and choose the <code className={code}>penandpaper-chrome</code> folder. Pin the icon.
        </>,
        <>
          Highlight something and click the icon, or press <Keys keys={["⌥", "⇧", "P"]} />. <Keys keys={["⌥", "⇧", "N"]} /> types a quick thought.
        </>,
      ]}
    />
  );
}

function MacCard({ windows }: { windows: boolean }) {
  return (
    <Card
      kind="mac"
      title="Mac app"
      blurb="Lives in the menu bar. Type a thought from any app, or hold a key and say it. Notes wait on your Mac if you're offline."
      button={
        <a href={MAC_ZIP} download="PenAndPaper-mac.zip" className={`${windows ? btn.outline : btn.primarySm} h-12 self-start ${focus}`}>
          Download for Mac
        </a>
      }
      under="macOS 13 or later, Apple silicon (M1 or newer)"
      steps={[
        "Unzip it and move Pen & Paper to Applications.",
        <>
          The first time, right-click the app and choose <b className="text-ink">Open</b> (it isn&apos;t notarized yet).
        </>,
        <>
          In Pen &amp; Paper, go to{" "}
          <Link href="/settings" className="font-medium text-ink underline underline-offset-2">
            Settings → Desktop app
          </Link>
          , create a token, and paste it into the app.
        </>,
        <>
          <Keys keys={["⌥", "⇧", "N"]} /> to type, hold <Keys keys={["⌥", "Space"]} /> to speak.
        </>,
      ]}
      note="Windows app: not yet. The Chrome or Edge extension and the web app work today."
    />
  );
}

/** For Windows (and anyone without the Mac app): the site itself, installed as an app. */
function WebAppCard() {
  const canInstall = useCanInstall();
  return (
    <Card
      kind="web"
      title="Windows: the app"
      blurb="Install Pen & Paper from Edge or Chrome. It gets its own window and taskbar icon, and opens straight to your paper."
      button={
        canInstall ? (
          <button type="button" onClick={() => void promptInstall()} className={`${btn.primarySm} self-start ${focus}`}>
            Install Pen &amp; Paper
          </button>
        ) : (
          <Link href="/drop" className={`${btn.outline} h-12 self-start ${focus}`}>
            Open my paper
          </Link>
        )
      }
      under={canInstall ? "Free, no download, updates itself" : undefined}
      steps={[
        <>
          Open your paper in Edge or Chrome.
        </>,
        <>
          Click the <b className="text-ink">install</b> icon at the right end of the address bar (or the account menu → <b className="text-ink">Install app</b>).
        </>,
        "Pin it to the taskbar. Typing, pasting and the mic all work in it; the system-wide shortcut is the Mac app's only extra.",
      ]}
    />
  );
}

/** The cards, with the visitor's own computer first. */
export function DownloadCards() {
  const platform = usePlatform();
  const windows = platform === "windows";
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {windows ? (
        <>
          <ChromeCard windows />
          <WebAppCard />
          <MacCard windows />
        </>
      ) : (
        <>
          <MacCard windows={false} />
          <ChromeCard windows={false} />
          {platform === "other" && <WebAppCard />}
        </>
      )}
    </div>
  );
}

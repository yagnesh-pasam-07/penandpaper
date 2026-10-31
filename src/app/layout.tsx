import type { Metadata, Viewport } from "next";
import { Caveat, Gurajada, Instrument_Sans, Inter, JetBrains_Mono, Kalam } from "next/font/google";
import { AppearanceBoot } from "@/components/appearance";
import { StoreBoot } from "@/components/hydration";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Handwriting for other scripts, so Hindi and Telugu thoughts stay handwritten.
// Only their own script subsets: the browser fetches them when those letters appear.
// Kalam: the notes' handwriting (most legible at 18–24px), Latin and Devanagari.
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin", "devanagari"],
  weight: ["300", "400", "700"],
});

const gurajada = Gurajada({
  variable: "--font-gurajada",
  subsets: ["telugu"],
  weight: "400",
  preload: false,
});

// The "Clear" note font (Settings): Inter, drawn for reading on screens. Not
// preloaded: only people who pick it download it.
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], weight: ["500", "600"], preload: false });

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Pen & Paper",
  description: "Pen and paper, digitally: write anywhere, draw between your thoughts, or just say it.",
  // iPhone and iPad: "Add to Home Screen" opens it like an app.
  appleWebApp: { capable: true, title: "Pen & Paper", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#151412" },
  ],
};

// Runs before first paint, so nothing flashes: the saved theme mode (light, dark or
// system, which follows the OS) and the saved canvas. Keys match src/lib/canvases.ts.
const themeScript = `(function(){try{var d=document.documentElement,m=localStorage.getItem("pp-theme"),c=localStorage.getItem("pp-canvas");if(m!=="light"&&m!=="dark")m="system";var t=m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;d.setAttribute("data-theme",t);d.setAttribute("data-theme-mode",m);d.setAttribute("data-canvas",c==="ruled"||c==="grid"?c:"dotted");d.setAttribute("data-note-font",localStorage.getItem("pp-note-font")==="clean"?"clean":"hand")}catch(e){}})()`;

// Holds Chrome's install offer until the account menu asks for it (keys match src/lib/install.ts).
const installScript = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__ppInstall=e;window.dispatchEvent(new Event("pp-install"))})`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-theme-mode="system"
      data-canvas="dotted"
      data-note-font="hand"
      suppressHydrationWarning
      className={`${instrument.variable} ${caveat.variable} ${kalam.variable} ${gurajada.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: installScript }} />
      </head>
      {/* Browser extensions often add attributes to <body>; don't treat that as a hydration error. */}
      <body className="min-h-full bg-bg text-ink" suppressHydrationWarning>
        <StoreBoot />
        <AppearanceBoot />
        {/* Grain for pencil strokes (used only on pencil ideas). */}
        <svg aria-hidden="true" width="0" height="0" className="absolute">
          <filter id="pencil-grain">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="3" result="g" />
            <feDisplacementMap in="SourceGraphic" in2="g" scale="0.9" />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  );
}

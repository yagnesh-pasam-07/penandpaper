/**
 * Where to find Yagnesh: LinkedIn, Instagram and X, each mark drawn by hand
 * like the rest of the brand (round pen strokes, a little uneven), in ink,
 * with the red pen on hover.
 */

const pen = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...pen}>
      <path d="M4.2 4.6c4.9-.5 10.4-.6 15.4.1.5 4.9.6 10 .1 14.9-5 .6-10.3.5-15.4.1-.6-5-.6-10.1-.1-15.1Z" />
      <path d="M8 10.6v6.3" />
      <circle cx="8" cy="7.7" r=".9" fill="currentColor" stroke="none" />
      <path d="M11.4 16.9v-6.2M11.5 13c.3-1.5 1.3-2.4 2.7-2.4 1.5 0 2.2 1 2.2 2.6v3.7" />
    </svg>
  );
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...pen}>
      <path d="M8 3.7c2.7-.3 5.4-.3 8.1 0 2.4.3 4 1.9 4.2 4.3.3 2.7.3 5.4 0 8.1-.3 2.3-1.9 3.9-4.3 4.2-2.7.3-5.3.3-8 0-2.4-.3-3.9-1.9-4.2-4.3-.3-2.7-.3-5.4 0-8 .3-2.4 1.9-4 4.2-4.3Z" />
      <path d="M12.1 8.2c2.2-.1 3.8 1.6 3.8 3.8 0 2.2-1.7 3.9-3.9 3.9-2.1 0-3.9-1.7-3.9-3.9.1-2.1 1.8-3.8 4-3.8Z" />
      <circle cx="16.9" cy="7.1" r=".95" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...pen}>
      <path d="M4.6 4.4c3.6 5.2 8.8 12.1 14.9 15.3" />
      <path d="M19.2 4.3c-2.4 2.3-4.8 4.8-6.9 7.4M10.9 13.4c-2 2.2-4 4.4-6.2 6.4" />
      <path d="M4.3 4.5h4.2l11 15.2h-4.1" strokeWidth="1.2" opacity=".7" />
    </svg>
  );
}

const LINKS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/yagneshpasam/", Mark: LinkedInMark },
  { label: "Instagram", href: "https://www.instagram.com/yagnesh.pasam/", Mark: InstagramMark },
  { label: "X", href: "https://x.com/YagneshPasam", Mark: XMark },
];

export function Social() {
  return (
    <ul className="flex flex-wrap gap-2 font-sans">
      {LINKS.map(({ label, href, Mark }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer me"
            className="flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[15px] text-ink transition-colors hover:border-red-text hover:text-red-text"
          >
            <Mark />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

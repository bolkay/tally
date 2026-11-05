import type { CSSProperties } from "react";

export function hue(name: string) {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({ name, size }: { name: string; size?: "lg" }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const style: CSSProperties = { background: `hsl(${hue(name)} 38% 42%)` };
  return (
    <span className={`avatar${size === "lg" ? " avatar-lg" : ""}`} style={style} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Wordmark() {
  return (
    <a href="/" className="wordmark" aria-label="Tally home">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <rect x="15" y="7" width="2" height="18" rx="1" fill="var(--paper)" />
        <rect x="6" y="10" width="9" height="4" rx="2" fill="#e5484d" />
        <rect x="17" y="18" width="9" height="4" rx="2" fill="#30a46c" />
      </svg>
      Tally
    </a>
  );
}

const paths = {
  plus: "M12 5v14M5 12h14",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  x: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  userPlus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" key={message + Date.now()}>
      {message}
    </div>
  );
}

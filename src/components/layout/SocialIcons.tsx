// lucide-react dropped brand/logo icons (trademark policy) — these two are
// hand-drawn to match its stroke style (round caps/joins, 1.5 stroke-width).
export function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4h-2.5A3.5 3.5 0 0 0 9 7.5V10H7v3h2v7h3v-7h2.5l.5-3H12V7.7c0-.66.4-1.2 1.2-1.2H15z" />
    </svg>
  );
}

export function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4v10.5a3.5 3.5 0 1 1 -3.5 -3.5" />
      <path d="M14 4c0 2.49 2.01 4.5 4.5 4.5" />
    </svg>
  );
}

export function SnapchatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4c-2.8 0-5 2.1-5 4.8v2.1c-.9.5-1.9.9-3 1 .7 1 1.7 1.6 2.8 1.8-.2.6-.5 1.1-1 1.5.9.3 1.9.4 2.9.3.5 1.2 1.7 2 3.3 2s2.8-.8 3.3-2c1 .1 2 0 2.9-.3-.5-.4-.8-.9-1-1.5 1.1-.2 2.1-.8 2.8-1.8-1.1-.1-2.1-.5-3-1v-2.1c0-2.7-2.2-4.8-5-4.8z" />
    </svg>
  );
}

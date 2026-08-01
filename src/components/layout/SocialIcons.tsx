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

// Official-style filled WhatsApp mark (white glyph on the green button) —
// reads far more clearly than a thin stroked version at button size.
export function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.29-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.64.14-.19.29-.74.93-.9 1.12-.17.19-.33.21-.62.07-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.59.13-.13.29-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.64-1.55-.88-2.12-.23-.56-.47-.48-.64-.49-.17-.01-.36-.01-.55-.01-.19 0-.51.07-.77.36-.26.29-1.01.99-1.01 2.4 0 1.42 1.03 2.78 1.18 2.97.15.19 2.03 3.1 4.92 4.35.69.3 1.22.47 1.64.6.69.22 1.31.19 1.81.12.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5c0-5.18 4.22-9.4 9.41-9.4 2.51 0 4.87.98 6.65 2.76a9.34 9.34 0 0 1 2.75 6.65c0 5.19-4.22 9.41-9.4 9.41zm8-17.41A11.32 11.32 0 0 0 12.04 1C5.8 1 .72 6.08.72 12.32c0 1.99.52 3.94 1.51 5.66L.63 23.4l5.55-1.46a11.29 11.29 0 0 0 5.86 1.6h.01c6.24 0 11.32-5.08 11.32-11.32 0-3.03-1.18-5.87-3.32-8.01z" />
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

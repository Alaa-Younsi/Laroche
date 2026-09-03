import { useRef } from "react";

export function useHoneypot() {
  const mountedAt = useRef(Date.now());
  const isSpam = (honeypotValue: string | undefined) =>
    !!honeypotValue || Date.now() - mountedAt.current < 1500;
  /** Milliseconds since the form mounted — server-side timing checks want this. */
  const elapsedMs = () => Date.now() - mountedAt.current;
  return { isSpam, elapsedMs };
}

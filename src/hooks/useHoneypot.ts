import { useRef } from "react";

export function useHoneypot() {
  const mountedAt = useRef(Date.now());
  const isSpam = (honeypotValue: string | undefined) =>
    !!honeypotValue || Date.now() - mountedAt.current < 1500;
  return { isSpam };
}

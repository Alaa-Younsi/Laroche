import { useEffect, useRef, useState } from "react";

/**
 * Scroll-reveal detection.
 *
 * Framer's `whileInView` / `useInView` (IntersectionObserver under the hood)
 * was leaving elements permanently stuck at their `initial` state on mobile —
 * whole sections of the landing page rendered as blank gaps because the
 * observer callback never fired for them. Geometry is checked directly here
 * instead: one rAF-throttled scroll/resize pass over every mounted element, so
 * an element can never end up hidden while it is on screen.
 */

interface Entry {
  el: Element;
  reveal: () => void;
}

/** Reveal once the element's top edge crosses this fraction of the viewport. */
const TRIGGER = 0.92;

const pending = new Set<Entry>();
let frame = 0;
let listening = false;

function flush() {
  frame = 0;
  const limit = window.innerHeight * TRIGGER;
  for (const entry of pending) {
    // `top < limit` covers elements scrolled past above the fold too (top < 0),
    // so nothing that has already gone by is left waiting.
    if (entry.el.getBoundingClientRect().top < limit) {
      entry.reveal();
      pending.delete(entry);
    }
  }
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(flush);
}

function register(entry: Entry) {
  pending.add(entry);
  if (!listening) {
    listening = true;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
  }
  schedule();
}

function unregister(entry: Entry) {
  pending.delete(entry);
}

/** `[ref, revealed]` — flips to true once and stays true. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || revealed) return;
    const entry: Entry = { el, reveal: () => setRevealed(true) };
    register(entry);
    return () => unregister(entry);
  }, [revealed]);

  return [ref, revealed] as const;
}

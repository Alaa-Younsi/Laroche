# Phone preview — a recording rig (temporary, delete before handoff)

Puts the live site inside a phone frame on a desktop screen, at the device's
real CSS viewport size, so the mobile experience can be screen-recorded without
filming an actual phone. Built for making client demo / ad videos.

**This is not a product feature. Delete it before the client sees the site** —
a phone icon in the header of a live store is exactly the sort of thing that
makes a finished site look unfinished.

## Removing it (3 steps, no side effects)

1. Delete `src/devtools/phone-preview/`. That leaves `src/devtools/` empty —
   delete it too.
2. `src/main.tsx` — remove the import and unwrap `<PhonePreview>` (re-indent
   `<BrowserRouter>`).
3. `src/components/layout/Header.tsx` — remove the import and the
   `<PhonePreviewButton />` line.

```
grep -rn "PHONE PREVIEW" src/
```

finds all of them; it must come back empty afterwards. Then
`bun run typecheck && bun run lint` to confirm nothing else referenced it —
nothing else should: nothing outside this folder imports from it, and it adds
no dependency that was not already installed (`zustand`, `lucide-react`).

## Using it

Click the phone icon in the header (desktop widths only — it is `md:inline-flex`
so it never crowds the mobile action row). Then:

- **Device buttons** — iPhone 15 Pro (393×852), iPhone SE (375×667),
  Pixel 8 Pro (412×915). Add devices in `DEVICES` in `state.ts`: CSS viewport
  size, corner radius, and notch style (`island` / `punch` / `none`).
- **Rotate** — landscape.
- **Fullscreen** — the phone is sized to fill whatever box it is given, so this
  is simply the biggest and sharpest it gets: worth ~15 % on a 1080p screen,
  and it keeps the tab strip and address bar out of a window capture. Esc
  leaves fullscreen without also leaving the preview.
- **✕ / Esc** — back to the desktop site.

The controls fade out after ~2.5 idle seconds and return on the first mouse
move, so a recording longer than that catches only the phone. The mode is kept
in `sessionStorage`, so reloading the page — which is how you re-trigger the
hero/intro animations — keeps you in the preview.

The frame opens on whatever route the desktop was showing, so toggling from
`/boutique` previews `/boutique`.

## Why an iframe and not a scaled `<div>`

Scaling a `<div>` down to 393px gets you the *desktop* layout drawn small:
`@media (max-width: 767px)` resolves against the window, `100vh` resolves
against the window, `position: fixed` escapes to the window, and any
media-query hook asks the window whether it is a phone. An iframe **is** a
window, so every one of those answers the way it would on the device. What you
record is the mobile site, not a small picture of the desktop one.

## The traps that shaped it (don't "simplify" these away)

- **`window.name`, not a `?phone=1` query flag.** React-router drops the query
  the moment you click a link inside the frame, so the inner app drew a second
  phone inside the first one as soon as anyone navigated. `window.name` is set
  on the element before its document exists and survives navigation and reload.
- **Two nested boxes for the scale transform.** A transform scales what is
  *painted* and leaves the layout box its original size, so centring a scaled
  phone centres the box it *used to* occupy — the phone hung off the bottom of
  the screen. The outer div takes the scaled dimensions; the inner one scales
  from `top left`.
- **Fit measured off the stage with a `ResizeObserver`,** not computed from
  `window.innerHeight` — the window is not the stage in fullscreen, and not
  when browser chrome changes height. A guessed margin cost the home indicator
  and the lower bezel in the shot.
- **The status bar is a reserved strip, not an overlay.** Floated over the
  glass, the Dynamic Island pill sat squarely on the header's language chip —
  the first thing in the video was a control with a black lozenge through it.
  Reserving it also gives the page the shorter viewport a phone really has.
- **The strips read their colours out of the frame's `body`**, with a
  `MutationObserver` on `data-theme`, so toggling dark/light *inside* the
  preview keeps the status bar in sync. The hardcoded initial pair is only the
  pre-load fallback — currently this project's default (dark) `--c-bg` /
  `--c-ink`.
- **Controls in a rail down the side, not a bar along the bottom.** The phone
  is as tall as the window allows, so there is no empty height under it — but
  hundreds of pixels of unused width either side.
- **`scrollbar-gutter: stable` is reclaimed while the rig is up.** A
  `fixed inset-0` element does not cover the reserved gutter, which left a
  strip of page background down the edge of the black backdrop, in shot.
- **`allow="autoplay; fullscreen"` on the iframe** — without it a muted
  autoplaying hero video records as a still poster.

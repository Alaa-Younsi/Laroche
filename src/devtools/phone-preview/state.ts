import { create } from "zustand";

/**
 * TEMPORARY — recording rig. See ./README.md for how to delete it.
 *
 * The whole feature lives in this folder plus two one-line insertion points
 * (src/main.tsx and src/components/layout/Header.tsx), both marked
 * `PHONE PREVIEW`.
 */

/** Shown as the iframe's accessible title. */
export const FRAME_TITLE = "Laroche Bijoux — aperçu mobile";

/**
 * The `name` the outer window gives the iframe.
 *
 * How the app knows which side of the glass it is on. The alternative was a
 * `?phone=1` query flag, which react-router drops the moment you click a link
 * inside the frame — so the inner app would draw a second phone inside the
 * first one as soon as anyone navigated. `window.name` is set on the element
 * before its document exists and survives both navigation and reload.
 */
const FRAME_NAME = "phone-preview-frame";

/** True only inside the previewed iframe: draw the site, not the rig. */
export const IN_PHONE_FRAME = typeof window !== "undefined" && window.name === FRAME_NAME;

export { FRAME_NAME };

/**
 * CSS viewport sizes, as the real devices report them. `short` is what the
 * side rail shows — the full name is the button's tooltip.
 */
export const DEVICES = {
  "iphone-15-pro": {
    label: "iPhone 15 Pro",
    short: "15 Pro",
    width: 393,
    height: 852,
    radius: 55,
    notch: "island",
  },
  "iphone-se": { label: "iPhone SE", short: "SE", width: 375, height: 667, radius: 42, notch: "none" },
  "pixel-8-pro": {
    label: "Pixel 8 Pro",
    short: "Pixel 8",
    width: 412,
    height: 915,
    radius: 46,
    notch: "punch",
  },
} as const;

export type DeviceKey = keyof typeof DEVICES;

const STORAGE_KEY = "phone-preview";

/**
 * sessionStorage, not component state: recording an intro/splash animation
 * means reloading the page over and over, and a preview that fell back to the
 * desktop layout on every reload would be useless for exactly the shot it
 * exists to get.
 */
function readStored(): { on: boolean; device: DeviceKey } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { on?: unknown; device?: unknown };
      const device =
        typeof parsed.device === "string" && parsed.device in DEVICES
          ? (parsed.device as DeviceKey)
          : "iphone-15-pro";
      return { on: parsed.on === true, device };
    }
  } catch {
    /* private mode, or a shape from an older build — start closed */
  }
  return { on: false, device: "iphone-15-pro" };
}

function persist(state: { on: boolean; device: DeviceKey }): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* nothing to do — the preview just won't survive a reload */
  }
}

interface PhonePreviewState {
  on: boolean;
  device: DeviceKey;
  toggle: () => void;
  close: () => void;
  setDevice: (device: DeviceKey) => void;
}

export const usePhonePreview = create<PhonePreviewState>()((set, get) => ({
  ...readStored(),
  toggle: () => {
    const next = { on: !get().on, device: get().device };
    persist(next);
    set(next);
  },
  close: () => {
    const next = { on: false, device: get().device };
    persist(next);
    set(next);
  },
  setDevice: (device) => {
    const next = { on: get().on, device };
    persist(next);
    set(next);
  },
}));

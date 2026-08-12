import { Smartphone } from "lucide-react";
import { IN_PHONE_FRAME, usePhonePreview } from "./state";

/**
 * TEMPORARY — recording rig. See ./README.md for how to delete it.
 *
 * Styled with the same classes as the other header chips (theme / language /
 * cart) so it does not distort the bar it is borrowing space in — the point of
 * the preview is to film the site as it really is, and a button that pushes the
 * wordmark sideways would change the shot. Hidden below `md` for the same
 * reason: the mobile action group is already tight, and the rig is only ever
 * clicked from the desktop anyway.
 */
export function PhonePreviewButton() {
  const toggle = usePhonePreview((s) => s.toggle);

  // never inside the glass: it would be in the video
  if (IN_PHONE_FRAME) return null;

  return (
    <button
      onClick={toggle}
      className="hidden rounded-full p-2 text-ink hover:bg-panel-2 md:inline-flex"
      aria-label="Phone preview"
      title="Phone preview — temporary recording tool"
    >
      <Smartphone size={19} />
    </button>
  );
}

import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Input } from "@/components/ui/Input";

/**
 * Barcode capture for a USB/Bluetooth scanner.
 *
 * Retail scanners are keyboard wedges: they "type" the digits far faster than a
 * human can and finish with Enter. So this is a plain focused input with an
 * Enter handler — no camera permission, no library, and it works with the
 * cheap scanners a shop in Algeria actually buys. Typing a code by hand into
 * the same box works identically, which is the fallback when a label is torn.
 *
 * It re-focuses itself after every submit: at a counter the cashier's hands are
 * on the goods, not the mouse, and a scanner that "does nothing" because focus
 * drifted is the single most common complaint about POS software.
 */
export function ScannerInput({
  onScan,
  autoFocus = true,
  placeholder,
}: {
  onScan: (code: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function submit() {
    const code = value.trim();
    if (!code) return;
    onScan(code);
    setValue("");
    ref.current?.focus();
  }

  return (
    <div className="relative">
      <ScanLine
        size={16}
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-brand"
      />
      <Input
        ref={ref}
        className="ps-10"
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder={placeholder ?? t("posScanPlaceholder")}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // The scanner's trailing Enter must not submit an enclosing form.
            e.preventDefault();
            submit();
          }
        }}
      />
    </div>
  );
}

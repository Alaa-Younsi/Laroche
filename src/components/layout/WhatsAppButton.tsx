import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageProvider";
import { WhatsAppIcon } from "@/components/layout/SocialIcons";

// Floating WhatsApp contact button, pinned bottom-right on every storefront
// page. Opens a chat with the boutique's number. The local number 0662628176
// becomes the international wa.me form 213662628176 (drop the leading 0, add
// Algeria's +213 country code).
const WHATSAPP_NUMBER = "213662628176";

export function WhatsAppButton() {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const label = t("whatsappContact");
  const href = `https://wa.me/${WHATSAPP_NUMBER}`;

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      initial={reducedMotion ? false : { opacity: 0, scale: 0, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.8 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_30px_-6px_rgba(37,211,102,0.6)] ltr:right-5 rtl:left-5 rtl:right-auto"
    >
      {/* pulsing ring to draw the eye without being noisy */}
      {!reducedMotion && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[#25D366]"
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <WhatsAppIcon size={28} />
    </motion.a>
  );
}

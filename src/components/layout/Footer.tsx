import { Link } from "react-router-dom";
import { ShieldCheck, Truck, BadgeCheck, Mail, Phone } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Wordmark } from "@/components/layout/Wordmark";
import { InstagramIcon, FacebookIcon, TikTokIcon, SnapchatIcon } from "@/components/layout/SocialIcons";
import { Reveal } from "@/components/effects/Reveal";

const linkClass =
  "inline-block transition-all duration-300 hover:text-brand hover:ps-1.5";

const SOCIAL_LINKS = [
  { href: "https://www.instagram.com/larochebijoux.officiel", label: "Instagram", Icon: InstagramIcon },
  {
    href: "https://www.facebook.com/laroche.bijoux1?rdid=iKK18O1R37rkylCc&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1bzp8n3T8D%2F#",
    label: "Facebook",
    Icon: FacebookIcon,
  },
  { href: "https://www.tiktok.com/@laroche.bijoux?_r=1&_t=ZS-98DaxIQMqqz", label: "TikTok", Icon: TikTokIcon },
  {
    href: "https://www.snapchat.com/@laroche.bijoux?share_id=C65MhCjR8FY&locale=fr-FR",
    label: "Snapchat",
    Icon: SnapchatIcon,
  },
] as const;

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <Reveal duration={0.55} className="md:col-span-1">
          <Wordmark className="items-start" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{t("footerAbout")}</p>
          <div className="mt-5 flex gap-3">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-line p-2 text-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-brand hover:text-brand"
                aria-label={label}
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal duration={0.55} delay={0.1}>
          <h4 className="mb-4 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide3 text-ink">
            <span className="h-px w-5 bg-brand" />
            {t("footerLinks")}
          </h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/boutique" className={linkClass}>{t("shopTitle")}</Link></li>
            <li><Link to="/boutique?collection=nouveautes" className={linkClass}>{t("sectionNewArrivals")}</Link></li>
            <li><Link to="/boutique?collection=promotions" className={linkClass}>{t("navPromotions")}</Link></li>
            <li><Link to="/politique-retour-livraison" className={linkClass}>{t("footerStorePolicy")}</Link></li>
          </ul>
        </Reveal>

        <Reveal duration={0.55} delay={0.2}>
          <h4 className="mb-4 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide3 text-ink">
            <span className="h-px w-5 bg-brand" />
            {t("navCollections")}
          </h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/boutique?categorie=bijoux-argent-925" className={linkClass}>{t("navSilver")}</Link></li>
            <li><Link to="/boutique?categorie=montres" className={linkClass}>{t("navWatches")}</Link></li>
            <li><Link to="/boutique?categorie=personnalisation" className={linkClass}>{t("navPersonalization")}</Link></li>
          </ul>
        </Reveal>

        <Reveal duration={0.55} delay={0.3}>
          <h4 className="mb-4 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide3 text-ink">
            <span className="h-px w-5 bg-brand" />
            {t("footerContact")}
          </h4>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-center gap-2">
              <Mail size={15} className="shrink-0 text-brand" />
              <a href="mailto:larochebijoux04@gmail.com" className="break-all transition-colors duration-300 hover:text-brand">
                larochebijoux04@gmail.com
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone size={15} className="shrink-0 text-brand" />
              {/* Forced LTR so the number keeps its reading order in the Arabic layout. */}
              <a href="tel:+213563030696" dir="ltr" className="transition-colors duration-300 hover:text-brand">
                0563030696
              </a>
            </li>
            <li className="flex items-center gap-2"><Truck size={15} className="shrink-0 text-brand" />{t("trustDelivery")}</li>
            <li className="flex items-center gap-2"><ShieldCheck size={15} className="shrink-0 text-brand" />{t("trustSecure")}</li>
            <li className="flex items-center gap-2"><BadgeCheck size={15} className="shrink-0 text-brand" />{t("trustAuthentic")}</li>
          </ul>
        </Reveal>
      </div>

      <div className="flex flex-col items-center gap-2 border-t border-line px-4 py-6 text-[0.65rem] uppercase tracking-wide2 text-muted sm:flex-row sm:justify-between md:px-8">
        <span>© {new Date().getFullYear()} Laroche Bijoux — {t("footerRights")}</span>
        <span>
          {t("footerCreatedBy")}{" "}
          <a
            href="https://alaayounsi.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink transition-colors duration-300 hover:text-brand"
          >
            Alaa Younsi
          </a>
        </span>
      </div>
    </footer>
  );
}

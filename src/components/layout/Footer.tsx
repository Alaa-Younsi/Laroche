import { Link } from "react-router-dom";
import { ShieldCheck, Truck, BadgeCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Wordmark } from "@/components/layout/Wordmark";
import { InstagramIcon, FacebookIcon } from "@/components/layout/SocialIcons";
import { Reveal } from "@/components/effects/Reveal";

const linkClass =
  "inline-block transition-all duration-300 hover:text-brand hover:ps-1.5";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <Reveal duration={0.55} className="md:col-span-1">
          <Wordmark className="items-start" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{t("footerAbout")}</p>
          <div className="mt-5 flex gap-3">
            <a
              href="#"
              className="rounded-full border border-line p-2 text-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-brand hover:text-brand"
              aria-label="Instagram"
            >
              <InstagramIcon size={16} />
            </a>
            <a
              href="#"
              className="rounded-full border border-line p-2 text-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-brand hover:text-brand"
              aria-label="Facebook"
            >
              <FacebookIcon size={16} />
            </a>
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
            <li className="flex items-center gap-2"><Truck size={15} className="text-brand" />{t("trustDelivery")}</li>
            <li className="flex items-center gap-2"><ShieldCheck size={15} className="text-brand" />{t("trustSecure")}</li>
            <li className="flex items-center gap-2"><BadgeCheck size={15} className="text-brand" />{t("trustAuthentic")}</li>
          </ul>
        </Reveal>
      </div>

      <div className="border-t border-line px-4 py-6 text-center text-[0.65rem] uppercase tracking-wide2 text-muted md:px-8">
        © {new Date().getFullYear()} Laroche Bijoux — {t("footerRights")}
      </div>
    </footer>
  );
}

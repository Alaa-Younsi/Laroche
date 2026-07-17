import { Link } from "react-router-dom";
import { ShieldCheck, Truck, BadgeCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Wordmark } from "@/components/layout/Wordmark";
import { InstagramIcon, FacebookIcon } from "@/components/layout/SocialIcons";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <div className="md:col-span-1">
          <Wordmark className="items-start" />
          <p className="mt-4 max-w-xs text-sm text-muted">{t("footerAbout")}</p>
          <div className="mt-5 flex gap-3">
            <a
              href="#"
              className="rounded-full border border-line p-2 text-muted transition-colors hover:border-brand hover:text-brand"
              aria-label="Instagram"
            >
              <InstagramIcon size={16} />
            </a>
            <a
              href="#"
              className="rounded-full border border-line p-2 text-muted transition-colors hover:border-brand hover:text-brand"
              aria-label="Facebook"
            >
              <FacebookIcon size={16} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide2 text-ink">
            {t("footerLinks")}
          </h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/boutique" className="hover:text-brand">{t("shopTitle")}</Link></li>
            <li><Link to="/boutique?collection=nouveautes" className="hover:text-brand">{t("sectionNewArrivals")}</Link></li>
            <li><Link to="/boutique?collection=promotions" className="hover:text-brand">{t("navPromotions")}</Link></li>
            <li><Link to="/favoris" className="hover:text-brand">{t("navWishlist")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide2 text-ink">
            {t("navCollections")}
          </h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/boutique?categorie=bijoux-argent-925" className="hover:text-brand">{t("navSilver")}</Link></li>
            <li><Link to="/boutique?categorie=montres" className="hover:text-brand">{t("navWatches")}</Link></li>
            <li><Link to="/boutique?categorie=personnalisation" className="hover:text-brand">{t("navPersonalization")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide2 text-ink">
            {t("footerContact")}
          </h4>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-center gap-2"><Truck size={15} className="text-brand" />{t("trustDelivery")}</li>
            <li className="flex items-center gap-2"><ShieldCheck size={15} className="text-brand" />{t("trustSecure")}</li>
            <li className="flex items-center gap-2"><BadgeCheck size={15} className="text-brand" />{t("trustAuthentic")}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line px-4 py-6 text-center text-xs text-muted md:px-8">
        © {new Date().getFullYear()} Laroche Bijoux — {t("footerRights")}
      </div>
    </footer>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Heart,
  ShoppingBag,
  Menu,
  Sun,
  Moon,
  Languages,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { useCategoryGroups } from "@/hooks/useCategories";
import { useCartStore } from "@/store/cart";
import { useWishlistStore } from "@/store/wishlist";
import { Drawer } from "@/components/ui/Drawer";
import { Wordmark } from "@/components/layout/Wordmark";
import { cn } from "@/lib/utils";

// Full category names ("Bijoux en Argent 925", "Bijoux en Acier
// Inoxydable") are the correct copy for page titles and the footer, but
// they're too long for a single-line desktop nav item — at common desktop
// widths (confirmed at 1440px) the flex row has no room and the label
// wraps onto two lines. Short-form labels only for the nav trigger.
const NAV_LABEL_OVERRIDES: Record<string, { fr: string; ar: string }> = {
  "bijoux-argent-925": { fr: "Argent 925", ar: "فضة 925" },
  "bijoux-acier-inox": { fr: "Acier Inox.", ar: "ستانلس ستيل" },
};

export function Header() {
  const { t, lang, setLang, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { data: groups = [] } = useCategoryGroups();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const openCart = useCartStore((s) => s.openCart);
  const wishlistCount = useWishlistStore((s) => s.productIds.length);
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const mobileSide = dir === "rtl" ? "right" : "left";

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/boutique?q=${encodeURIComponent(searchValue.trim())}`);
      setSearchOpen(false);
      setSearchValue("");
    }
  }

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md"
    >
      <div className="hidden items-center justify-center gap-8 border-b border-line bg-panel-2/60 px-4 py-2 text-[0.7rem] tracking-wide2 uppercase text-muted md:flex">
        <span>{t("topbarShipping")}</span>
        <span className="text-brand">•</span>
        <span>{t("topbarWarranty")}</span>
        <span className="text-brand">•</span>
        <span>{t("topbarPayment")}</span>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <button
          className="rounded-full p-2 text-ink hover:bg-panel-2 xl:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="menu"
        >
          <Menu size={22} />
        </button>

        <Wordmark className="xl:me-6" />

        <nav className="hidden min-w-0 items-center gap-4 xl:flex xl:gap-6">
          <Link
            to="/"
            className="group relative shrink-0 whitespace-nowrap text-xs font-medium uppercase tracking-wide2 text-ink transition-colors hover:text-brand"
          >
            {t("navHome")}
            <span className="absolute -bottom-1.5 start-0 h-px w-0 bg-brand transition-all duration-300 group-hover:w-full" />
          </Link>
          {groups.map((group) => (
            <div
              key={group.id}
              className="relative"
              onMouseEnter={() => setOpenMenu(group.id)}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <Link
                to={`/boutique?categorie=${group.slug}`}
                className="group relative flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium uppercase tracking-wide2 text-ink transition-colors hover:text-brand"
              >
                {(() => {
                  const override = NAV_LABEL_OVERRIDES[group.slug];
                  if (override) return lang === "ar" ? override.ar : override.fr;
                  return lang === "ar" ? group.name_ar : group.name_fr;
                })()}
                {group.children.length > 0 && (
                  <ChevronDown
                    size={12}
                    className="transition-transform duration-300 group-hover:rotate-180"
                  />
                )}
                <span className="absolute -bottom-1.5 start-0 h-px w-0 bg-brand transition-all duration-300 group-hover:w-full" />
              </Link>
              <AnimatePresence>
                {openMenu === group.id && group.children.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute start-0 top-full z-40 min-w-52 border border-line bg-panel p-2 shadow-panel"
                  >
                    {group.children.map((child, ci) => (
                      <motion.div
                        key={child.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: ci * 0.045 }}
                      >
                        <Link
                          to={`/boutique?categorie=${child.slug}`}
                          className="group/item flex items-center px-4 py-2.5 text-sm text-ink transition-colors hover:bg-panel-2 hover:text-brand"
                        >
                          <span className="inline-block h-px w-0 bg-brand transition-all duration-300 group-hover/item:me-2 group-hover/item:w-3" />
                          {lang === "ar" ? child.name_ar : child.name_fr}
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          <Link
            to="/boutique?collection=promotions"
            className="group relative shrink-0 whitespace-nowrap text-xs font-medium uppercase tracking-wide2 text-brand transition-colors hover:brightness-110"
          >
            {t("navPromotions")}
            <span className="absolute -bottom-1.5 start-0 h-px w-0 bg-brand transition-all duration-300 group-hover:w-full" />
          </Link>
        </nav>

        <div className="flex items-center gap-1 md:gap-2">
          <button
            className="rounded-full p-2 text-ink hover:bg-panel-2"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={t("search")}
          >
            <Search size={19} />
          </button>
          <button
            className="hidden rounded-full p-2 text-ink hover:bg-panel-2 md:inline-flex"
            onClick={toggleTheme}
            aria-label={t("toggleTheme")}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="hidden items-center gap-1 rounded-full p-2 text-xs font-medium text-ink hover:bg-panel-2 md:inline-flex"
            onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
            aria-label={t("toggleLang")}
          >
            <Languages size={17} />
            {t("toggleLang")}
          </button>
          <Link
            to="/favoris"
            className="relative rounded-full p-2 text-ink hover:bg-panel-2"
            aria-label={t("navWishlist")}
          >
            <Heart size={19} />
            {wishlistCount > 0 && (
              <motion.span
                key={wishlistCount}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="absolute -top-0.5 end-0 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[0.6rem] font-semibold text-brand-ink"
              >
                {wishlistCount}
              </motion.span>
            )}
          </Link>
          <button
            className="relative rounded-full p-2 text-ink hover:bg-panel-2"
            onClick={openCart}
            aria-label={t("navCart")}
          >
            <ShoppingBag size={19} />
            {cartCount > 0 && (
              <motion.span
                key={cartCount}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="absolute -top-0.5 end-0 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[0.6rem] font-semibold text-brand-ink"
              >
                {cartCount}
              </motion.span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line"
          >
            <form
              onSubmit={submitSearch}
              className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4"
            >
              <Search size={18} className="text-muted" />
              <input
                autoFocus
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} side={mobileSide}>
        <nav className="flex flex-col gap-1 p-4">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-4 py-3 text-sm font-medium uppercase tracking-wide2 text-ink hover:bg-panel-2"
          >
            {t("navHome")}
          </Link>
          {groups.map((group) => (
            <div key={group.id} className="mb-1">
              <Link
                to={`/boutique?categorie=${group.slug}`}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block rounded-lg px-4 py-3 text-sm font-medium uppercase tracking-wide2 text-ink hover:bg-panel-2",
                )}
              >
                {lang === "ar" ? group.name_ar : group.name_fr}
              </Link>
              {group.children.length > 0 && (
                <div className="ms-4 border-s border-line ps-2">
                  {group.children.map((child) => (
                    <Link
                      key={child.id}
                      to={`/boutique?categorie=${child.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-4 py-2 text-sm text-muted hover:bg-panel-2 hover:text-ink"
                    >
                      {lang === "ar" ? child.name_ar : child.name_fr}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link
            to="/boutique?collection=promotions"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-4 py-3 text-sm font-medium uppercase tracking-wide2 text-brand hover:bg-panel-2"
          >
            {t("navPromotions")}
          </Link>

          <div className="mt-4 flex items-center justify-between border-t border-line px-4 pt-4">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-sm text-ink"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              {t("toggleTheme")}
            </button>
            <button
              onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
              className="flex items-center gap-2 text-sm text-ink"
            >
              <Languages size={18} />
              {t("toggleLang")}
            </button>
          </div>
        </nav>
      </Drawer>
    </motion.header>
  );
}

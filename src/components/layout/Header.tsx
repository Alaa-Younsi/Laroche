import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingBag,
  Menu,
  X,
  Sun,
  Moon,
  Languages,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { useCategoryGroups } from "@/hooks/useCategories";
import { useCartStore } from "@/store/cart";
import { Wordmark } from "@/components/layout/Wordmark";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/lib/categoryTree";

const DESKTOP_DEPTH_PADDING = ["ps-4", "ps-7", "ps-10"] as const;
const MOBILE_DEPTH_PADDING = ["ps-8", "ps-11", "ps-14"] as const;

function DesktopMenuItem({ node, depth, index, lang }: { node: CategoryNode; depth: number; index: number; lang: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.045 }}
    >
      <Link
        to={`/boutique?categorie=${node.slug}`}
        className={cn(
          "group/item flex items-center pe-4 py-2.5 transition-colors hover:bg-panel-2 hover:text-brand",
          DESKTOP_DEPTH_PADDING[Math.min(depth, DESKTOP_DEPTH_PADDING.length - 1)],
          depth === 0 ? "text-sm text-ink" : "text-xs text-muted",
        )}
      >
        <span className="inline-block h-px w-0 bg-brand transition-all duration-300 group-hover/item:me-2 group-hover/item:w-3" />
        {lang === "ar" ? node.name_ar : node.name_fr}
      </Link>
      {node.children.map((child, ci) => (
        <DesktopMenuItem key={child.id} node={child} depth={depth + 1} index={ci} lang={lang} />
      ))}
    </motion.div>
  );
}

function MobileCategoryLinks({ nodes, depth, lang }: { nodes: CategoryNode[]; depth: number; lang: string }) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <Link
            to={`/boutique?categorie=${node.slug}`}
            className={cn(
              "block py-2.5 pe-4 text-[0.8rem]",
              MOBILE_DEPTH_PADDING[Math.min(depth, MOBILE_DEPTH_PADDING.length - 1)],
              depth === 0 ? "text-muted" : "text-muted/80",
            )}
          >
            {lang === "ar" ? node.name_ar : node.name_fr}
          </Link>
          {node.children.length > 0 && (
            <MobileCategoryLinks nodes={node.children} depth={depth + 1} lang={lang} />
          )}
        </div>
      ))}
    </>
  );
}

export function Header() {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { data: groups = [] } = useCategoryGroups();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const openCart = useCartStore((s) => s.openCart);
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  /** Which mobile category accordion is expanded. */
  const [openSection, setOpenSection] = useState<string | null>(null);

  // navigating away must always collapse the panel, otherwise it stays open
  // over the new page
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setOpenSection(null);
  }, [location.pathname, location.search]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/boutique?q=${encodeURIComponent(searchValue.trim())}`);
      setSearchOpen(false);
      setSearchValue("");
    }
  }

  function toggleMobile() {
    setMobileOpen((v) => !v);
    setSearchOpen(false);
  }

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      // z-50 keeps the bar above the hero's floating stamp and the editorial
      // badge, which otherwise scrolled over the top of it
      className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur-md"
    >
      <div className="hidden items-center justify-center gap-8 border-b border-line bg-panel-2/60 px-4 py-2 text-[0.7rem] tracking-wide2 uppercase text-muted md:flex">
        <span>{t("topbarShipping")}</span>
        <span className="text-brand">•</span>
        <span>{t("topbarWarranty")}</span>
        <span className="text-brand">•</span>
        <span>{t("topbarPayment")}</span>
      </div>

      {/* three columns on mobile so the wordmark is optically centred no matter
          how many action icons are showing; the desktop row takes over at xl */}
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:px-4 md:px-8 xl:flex xl:justify-between xl:gap-4 xl:py-4">
        <button
          className="-ms-2 justify-self-start rounded-full p-2.5 text-ink transition-colors hover:bg-panel-2 xl:hidden"
          onClick={toggleMobile}
          aria-label="menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
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
          {groups.length > 0 && (
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu("shop")}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <Link
                to="/boutique"
                className="group relative flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium uppercase tracking-wide2 text-ink transition-colors hover:text-brand"
              >
                {t("shopTitle")}
                <ChevronDown
                  size={12}
                  className="transition-transform duration-300 group-hover:rotate-180"
                />
                <span className="absolute -bottom-1.5 start-0 h-px w-0 bg-brand transition-all duration-300 group-hover:w-full" />
              </Link>
              <AnimatePresence>
                {openMenu === "shop" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute start-0 top-full z-40 flex w-[38rem] max-w-[90vw] flex-wrap gap-x-8 gap-y-5 border border-line bg-panel p-6 shadow-panel"
                  >
                    {groups.map((group) => (
                      <div key={group.id} className="w-44 shrink-0">
                        <Link
                          to={`/boutique?categorie=${group.slug}`}
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide2 text-ink transition-colors hover:text-brand"
                        >
                          {lang === "ar" ? group.name_ar : group.name_fr}
                        </Link>
                        {group.children.map((child, ci) => (
                          <DesktopMenuItem key={child.id} node={child} depth={0} index={ci} lang={lang} />
                        ))}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          <Link
            to="/boutique?collection=promotions"
            className="group relative shrink-0 whitespace-nowrap text-xs font-medium uppercase tracking-wide2 text-brand transition-colors hover:brightness-110"
          >
            {t("navPromotions")}
            <span className="absolute -bottom-1.5 start-0 h-px w-0 bg-brand transition-all duration-300 group-hover:w-full" />
          </Link>
        </nav>

        <div className="flex items-center justify-self-end gap-0.5 md:gap-2">
          <button
            className="rounded-full p-2.5 text-ink transition-colors hover:bg-panel-2"
            onClick={() => {
              setSearchOpen((v) => !v);
              setMobileOpen(false);
            }}
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

      {/* Mobile nav: expands inline under the bar rather than sliding in as an
          overlay panel — the toggle stays put and the page never jumps. */}
      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.nav
            id="mobile-nav"
            key="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line bg-bg xl:hidden"
          >
            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto overscroll-contain">
              <Link
                to="/"
                className="flex items-center border-b border-line/60 px-4 py-3.5 text-[0.8rem] font-medium uppercase tracking-wide2 text-ink"
              >
                {t("navHome")}
              </Link>

              {groups.map((group) => {
                const label = lang === "ar" ? group.name_ar : group.name_fr;
                const expanded = openSection === group.id;
                return (
                  <div key={group.id} className="border-b border-line/60">
                    <div className="flex items-stretch">
                      <Link
                        to={`/boutique?categorie=${group.slug}`}
                        className="flex-1 px-4 py-3.5 text-[0.8rem] font-medium uppercase tracking-wide2 text-ink"
                      >
                        {label}
                      </Link>
                      {group.children.length > 0 && (
                        <button
                          onClick={() => setOpenSection(expanded ? null : group.id)}
                          className="px-4 text-muted transition-colors hover:text-brand"
                          aria-label={label}
                          aria-expanded={expanded}
                        >
                          <ChevronDown
                            size={16}
                            className={cn(
                              "transition-transform duration-300",
                              expanded && "rotate-180",
                            )}
                          />
                        </button>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {expanded && group.children.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden bg-panel/50"
                        >
                          <MobileCategoryLinks nodes={group.children} depth={0} lang={lang} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              <Link
                to="/boutique?collection=promotions"
                className="flex items-center border-b border-line/60 px-4 py-3.5 text-[0.8rem] font-medium uppercase tracking-wide2 text-brand"
              >
                {t("navPromotions")}
              </Link>

              <div className="flex items-center justify-between px-4 py-4">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 text-[0.8rem] text-muted"
                >
                  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                  {t("toggleTheme")}
                </button>
                <button
                  onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
                  className="flex items-center gap-2 text-[0.8rem] text-muted"
                >
                  <Languages size={17} />
                  {t("toggleLang")}
                </button>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

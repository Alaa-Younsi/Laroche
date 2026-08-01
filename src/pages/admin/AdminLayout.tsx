import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, NavLink, Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Truck,
  Star,
  Mail,
  UserCog,
  LogOut,
  Menu,
  Sun,
  Moon,
  Languages,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { Drawer } from "@/components/ui/Drawer";
import { Wordmark } from "@/components/layout/Wordmark";
import { cn } from "@/lib/utils";

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useLanguage();

  const links = [
    { to: "/admin", label: t("adminDashboard"), icon: LayoutDashboard, end: true },
    { to: "/admin/produits", label: t("adminProducts"), icon: Package },
    { to: "/admin/catalogue", label: t("adminCategories"), icon: Tags },
    { to: "/admin/commandes", label: t("adminOrders"), icon: ShoppingCart },
    { to: "/admin/livraison", label: t("adminDeliveryPrices"), icon: Truck },
    { to: "/admin/avis", label: t("adminReviews"), icon: Star },
    { to: "/admin/newsletter", label: t("adminNewsletter"), icon: Mail },
    { to: "/admin/compte", label: t("adminAccount"), icon: UserCog },
  ];

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
              isActive ? "bg-brand/10 text-brand" : "text-muted hover:bg-panel-2 hover:text-ink",
            )
          }
        >
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  return (
    <div className="space-y-1 border-t border-line pt-4">
      <Link
        to="/"
        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-muted hover:bg-panel-2 hover:text-ink"
      >
        <ArrowLeft size={16} className="rtl:rotate-180" />
        {t("adminBackToSite")}
      </Link>
      <button
        onClick={toggleTheme}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-muted hover:bg-panel-2 hover:text-ink"
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {t("toggleTheme")}
      </button>
      <button
        onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-muted hover:bg-panel-2 hover:text-ink"
      >
        <Languages size={16} />
        {t("toggleLang")}
      </button>
      <button
        onClick={() => signOut()}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10"
      >
        <LogOut size={16} />
        {t("adminSignOut")}
      </button>
    </div>
  );
}

export function AdminLayout(): ReactNode {
  const { isAuthenticated, loading } = useAuth();
  const { dir } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // <main> scrolls instead of the window here, so the global <ScrollToTop />
  // can't reach it — reset this pane ourselves on every admin route change.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">…</div>;
  }
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  const mobileSide = dir === "rtl" ? "right" : "left";

  // The shell is pinned to the viewport (h-dvh, not min-h-screen) and clips its
  // own overflow, so the sidebar and the content area each own a scroll region.
  // The sidebar therefore stays full-height and fixed no matter how long the
  // page under it gets — a 300-row orders table scrolls inside <main> alone.
  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <aside className="hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-e border-line bg-panel p-5 lg:flex">
        <Wordmark className="mb-8 items-start" />
        <div className="flex-1">
          <NavItems />
        </div>
        <SidebarFooter />
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-panel px-4 py-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="menu">
            <Menu size={22} />
          </button>
          <Wordmark />
          <div className="w-6" />
        </div>

        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} side={mobileSide}>
          <div className="flex h-full flex-col p-5">
            <div className="flex-1">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
            <SidebarFooter />
          </div>
        </Drawer>

        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

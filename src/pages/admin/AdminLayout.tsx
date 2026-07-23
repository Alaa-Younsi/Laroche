import { useState, type ReactNode } from "react";
import { Navigate, NavLink, Link, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Truck,
  Star,
  Mail,
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

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">…</div>;
  }
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  const mobileSide = dir === "rtl" ? "right" : "left";

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-line bg-panel p-5 lg:flex">
        <Wordmark className="mb-8 items-start" />
        <div className="flex-1">
          <NavItems />
        </div>
        <SidebarFooter />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-3 lg:hidden">
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

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

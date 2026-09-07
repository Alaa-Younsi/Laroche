import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu, Sun, Moon, Languages, ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { Drawer } from "@/components/ui/Drawer";
import { AdminToastProvider } from "@/components/admin/AdminToast";
import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/Button";
import { ADMIN_SECTIONS, routeToSection, type AdminSection } from "@/lib/adminSections";
import { cn } from "@/lib/utils";

function NavItems({
  sections,
  onNavigate,
}: {
  sections: AdminSection[];
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <nav className="flex flex-col gap-1">
      {sections.map(({ key, route, exact, labelKey, icon: Icon }) => (
        <NavLink
          key={key}
          to={route}
          end={exact}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
              isActive ? "bg-brand/10 text-brand" : "text-muted hover:bg-panel-2 hover:text-ink",
            )
          }
        >
          <Icon size={17} />
          {t(labelKey)}
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
    <div className="mt-4 shrink-0 space-y-1 border-t border-line pt-4">
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

function NoAccess() {
  const { t } = useLanguage();
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <ShieldAlert size={40} className="text-red-500" />
      <div>
        <h1 className="font-display text-2xl text-ink">{t("adminNoAccessTitle")}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">{t("adminNoAccessBody")}</p>
      </div>
      <Button variant="outline" onClick={() => signOut()}>
        <LogOut size={15} /> {t("adminSignOut")}
      </Button>
    </div>
  );
}

export function AdminLayout(): ReactNode {
  const { isAuthenticated, loading } = useAuth();
  const { isOwner, isActive, hasSection, isLoading: profileLoading } = useAdminProfile();
  const { dir } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // <main> scrolls instead of the window here, so the global <ScrollToTop />
  // can't reach it — reset this pane ourselves on every admin route change.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // Hold the loading screen until the profile has landed too — without this the
  // first render has no profile yet and bounces a legitimate worker.
  if (loading || (isAuthenticated && profileLoading)) {
    return <div className="flex min-h-screen items-center justify-center text-muted">…</div>;
  }
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  // A session is authentication, not authorization: no admin_profiles row (or a
  // deactivated one) means no dashboard. Show a way out rather than an empty
  // dashboard or a redirect loop.
  if (!isActive) return <NoAccess />;

  function canAccess(section: AdminSection): boolean {
    if (section.ownerOnly) return isOwner;
    if (section.always) return true;
    return hasSection(section.key);
  }

  const visibleSections = ADMIN_SECTIONS.filter(canAccess);

  // Same predicate guards a direct URL. The dashboard is `always`, so the
  // redirect target can never itself be forbidden — no loop.
  const currentSection = routeToSection(pathname);
  if (currentSection && !canAccess(currentSection)) {
    return <Navigate to="/admin" replace />;
  }

  const mobileSide = dir === "rtl" ? "right" : "left";

  // The shell is pinned to the viewport (h-dvh, not min-h-screen) and clips its
  // own overflow, so the sidebar and the content area each own a scroll region.
  // The sidebar therefore stays full-height and fixed no matter how long the
  // page under it gets — a 300-row orders table scrolls inside <main> alone.
  return (
    <AdminToastProvider>
      <div className="flex h-dvh overflow-hidden bg-bg">
        <aside className="hidden h-full w-64 shrink-0 flex-col overflow-hidden border-e border-line bg-panel p-5 lg:flex">
          <Wordmark className="mb-8 shrink-0 items-start" />
          {/* Only the links scroll: min-h-0 lets this flex child shrink below its
              content height, which is what confines the scrollbar to this box and
              keeps the wordmark and footer pinned. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NavItems sections={visibleSections} />
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
            <div className="flex h-full flex-col overflow-hidden p-5">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <NavItems sections={visibleSections} onNavigate={() => setMobileOpen(false)} />
              </div>
              <SidebarFooter />
            </div>
          </Drawer>

          {/* min-w-0 + overflow-x-hidden: the shell must never scroll sideways.
              Wide data tables keep their own overflow-x-auto wrapper and scroll
              inside their box instead of dragging the whole layout with them. */}
          <main
            ref={mainRef}
            className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </AdminToastProvider>
  );
}

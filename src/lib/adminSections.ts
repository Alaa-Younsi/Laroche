import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Truck,
  Star,
  Mail,
  Target,
  Users,
  UserCog,
  TrendingUp,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/i18n/translations";

// One source of truth for the admin sidebar, the route → permission mapping and
// the owner's grant checklist on /admin/equipe.
//
// ⚠ `key` MUST equal the has_section('…') string used in
// supabase/migrations/0016_admin_permissions.sql AND appear in ALLOWED_SECTIONS
// in api/_lib/adminTeam.ts. A key present here but missing from the whitelist is
// granted in the UI and silently dropped on save — the worker then sees a nav
// item that redirects them straight back to /admin.

export interface AdminSection {
  key: string;
  route: string;
  exact?: boolean;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** visible to every admin, grantable to none (the overview, own account) */
  always?: boolean;
  /** only the owner ever sees it */
  ownerOnly?: boolean;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: "dashboard",
    route: "/admin",
    exact: true,
    labelKey: "adminDashboard",
    icon: LayoutDashboard,
    always: true,
  },
  { key: "products", route: "/admin/produits", labelKey: "adminProducts", icon: Package },
  { key: "categories", route: "/admin/catalogue", labelKey: "adminCategories", icon: Tags },
  { key: "orders", route: "/admin/commandes", labelKey: "adminOrders", icon: ShoppingCart },
  { key: "delivery", route: "/admin/livraison", labelKey: "adminDeliveryPrices", icon: Truck },
  { key: "reviews", route: "/admin/avis", labelKey: "adminReviews", icon: Star },
  { key: "newsletter", route: "/admin/newsletter", labelKey: "adminNewsletter", icon: Mail },
  { key: "pixels", route: "/admin/pixels", labelKey: "adminPixels", icon: Target },
  { key: "finance", route: "/admin/finances", labelKey: "adminFinance", icon: TrendingUp },
  { key: "store", route: "/admin/magasin", labelKey: "adminStore", icon: Store },
  {
    key: "team",
    route: "/admin/equipe",
    labelKey: "adminTeam",
    icon: Users,
    ownerOnly: true,
  },
  {
    key: "account",
    route: "/admin/compte",
    labelKey: "adminAccount",
    icon: UserCog,
    always: true,
  },
];

/** The sections an owner can tick for a worker. */
export const GRANTABLE_SECTIONS = ADMIN_SECTIONS.filter((s) => !s.always && !s.ownerOnly);

/**
 * Resolve a pathname to the section that owns it. The exact `/admin` overview
 * is checked first, then the LONGEST matching route prefix — otherwise `/admin`
 * shadows everything as a prefix and `/admin/produits/nouveau` never maps to
 * `products`.
 */
export function routeToSection(pathname: string): AdminSection | undefined {
  const path = pathname.replace(/\/+$/, "") || "/admin";

  const exact = ADMIN_SECTIONS.find((s) => s.exact && s.route === path);
  if (exact) return exact;

  return ADMIN_SECTIONS.filter((s) => !s.exact)
    .filter((s) => path === s.route || path.startsWith(`${s.route}/`))
    .sort((a, b) => b.route.length - a.route.length)[0];
}

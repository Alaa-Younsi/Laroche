import { lazy, Suspense } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { GaPageView } from "@/components/layout/GaPageView";
import { MetaPixelProvider } from "@/components/MetaPixelProvider";
import { StorefrontLayout } from "@/components/layout/StorefrontLayout";
import { ErrorBoundary } from "@/components/effects/ErrorBoundary";
import { useLanguage } from "@/i18n/LanguageProvider";

const Landing = lazy(() => import("@/pages/Landing"));
const Shop = lazy(() => import("@/pages/Shop"));
const Product = lazy(() => import("@/pages/Product"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const OrderConfirmation = lazy(() => import("@/pages/OrderConfirmation"));
const StorePolicy = lazy(() => import("@/pages/StorePolicy"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const AdminLayout = lazy(() =>
  import("@/pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("@/pages/admin/Products"));
const AdminProductForm = lazy(() => import("@/pages/admin/ProductForm"));
const AdminCatalogue = lazy(() => import("@/pages/admin/Categories"));
const AdminOrders = lazy(() => import("@/pages/admin/Orders"));
const AdminOrderDetail = lazy(() => import("@/pages/admin/OrderDetail"));
const AdminDeliveryPrices = lazy(() => import("@/pages/admin/DeliveryPrices"));
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"));
const AdminNewsletter = lazy(() => import("@/pages/admin/Newsletter"));
const AdminAccount = lazy(() => import("@/pages/admin/Account"));
const AdminPixels = lazy(() => import("@/pages/admin/Pixels"));
const AdminTeam = lazy(() => import("@/pages/admin/Team"));
const AdminFinance = lazy(() => import("@/pages/admin/Finance"));
const AdminStoreLedger = lazy(() => import("@/pages/admin/StoreLedger"));

function RouteFallback() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-3 py-32 text-center">
      <span className="animate-sparkle text-2xl text-brand">✦</span>
      <span className="text-xs uppercase tracking-wide3 text-muted">{t("loading")}</span>
    </div>
  );
}

function RouteError() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-4 py-32 text-center">
      <span className="text-2xl text-brand">✦</span>
      <p className="text-sm text-muted">{t("errorGeneric")}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-brand px-5 py-2 text-sm text-brand-ink"
        >
          {t("retry")}
        </button>
        <Link to="/" className="rounded-full border border-line px-5 py-2 text-sm text-ink">
          {t("navHome")}
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <MetaPixelProvider>
      <ScrollToTop />
      <GaPageView />
      <ErrorBoundary scope="route" fallback={<RouteError />}>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<StorefrontLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/boutique" element={<Shop />} />
            <Route path="/produit/:slug" element={<Product />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/commande/:orderNumber" element={<OrderConfirmation />} />
            <Route path="/politique-retour-livraison" element={<StorePolicy />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="produits" element={<AdminProducts />} />
            <Route path="produits/nouveau" element={<AdminProductForm />} />
            <Route path="produits/:id" element={<AdminProductForm />} />
            <Route path="catalogue" element={<AdminCatalogue />} />
            <Route path="commandes" element={<AdminOrders />} />
            <Route path="commandes/:id" element={<AdminOrderDetail />} />
            <Route path="livraison" element={<AdminDeliveryPrices />} />
            <Route path="avis" element={<AdminReviews />} />
            <Route path="newsletter" element={<AdminNewsletter />} />
            <Route path="compte" element={<AdminAccount />} />
            <Route path="pixels" element={<AdminPixels />} />
            <Route path="equipe" element={<AdminTeam />} />
            <Route path="finances" element={<AdminFinance />} />
            <Route path="magasin" element={<AdminStoreLedger />} />
          </Route>
        </Routes>
        </Suspense>
      </ErrorBoundary>
    </MetaPixelProvider>
  );
}

export default App;

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { PixelPageView } from "@/components/layout/PixelPageView";
import { StorefrontLayout } from "@/components/layout/StorefrontLayout";
import { useLanguage } from "@/i18n/LanguageProvider";

const Landing = lazy(() => import("@/pages/Landing"));
const Shop = lazy(() => import("@/pages/Shop"));
const Product = lazy(() => import("@/pages/Product"));
const Wishlist = lazy(() => import("@/pages/Wishlist"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const OrderConfirmation = lazy(() => import("@/pages/OrderConfirmation"));
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

function RouteFallback() {
  const { t } = useLanguage();
  return <div className="py-32 text-center text-muted">{t("loading")}</div>;
}

function App() {
  return (
    <>
      <ScrollToTop />
      <PixelPageView />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<StorefrontLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/boutique" element={<Shop />} />
            <Route path="/produit/:slug" element={<Product />} />
            <Route path="/favoris" element={<Wishlist />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/commande/:orderNumber" element={<OrderConfirmation />} />
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
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default App;

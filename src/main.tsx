import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Self-hosted fonts (was a render-blocking Google Fonts <link> + a third-party
// origin the CSP had to whitelist). fontsource emits @font-face with
// unicode-range, so the browser still only downloads the subset it renders.
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "@fontsource/jost/600.css";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import "@fontsource/almarai/300.css";
import "@fontsource/almarai/400.css";
import "@fontsource/almarai/700.css";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "@/components/effects/ErrorBoundary";
import { AppErrorFallback } from "@/components/effects/AppErrorFallback";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { initAnalytics } from "@/lib/analytics";

// the wishlist feature was removed — drop the persisted state of returning visitors
localStorage.removeItem("laroche-wishlist");

initAnalytics();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 60_000 },
  },
});

// preconnect to Supabase — first query + every image come from there,
// but the project ref isn't known until VITE_SUPABASE_URL is set, so this
// has to happen at runtime rather than as a static <link> in index.html.
if (import.meta.env.VITE_SUPABASE_URL) {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = import.meta.env.VITE_SUPABASE_URL;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallback={<AppErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

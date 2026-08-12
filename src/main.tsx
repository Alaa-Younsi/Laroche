import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { initAnalytics } from "@/lib/analytics";
// PHONE PREVIEW — temporary recording rig, delete with the folder it points at
import { PhonePreview } from "@/devtools/phone-preview/PhonePreview";

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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          {/* PHONE PREVIEW — temporary recording rig. Delete this wrapper, its
              import, and src/devtools/phone-preview/ to remove. It must stay
              OUTSIDE BrowserRouter: the rig replaces the whole routed tree
              while it is up, and a rig inside the router would remount on
              every navigation. */}
          <PhonePreview>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </PhonePreview>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SITE_URL: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  // VITE_META_PIXEL_ID is gone on purpose: pixels are managed in /admin/pixels
  // and loaded from the database at runtime (src/lib/metaPixel.ts).
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

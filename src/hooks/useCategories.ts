import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { buildCategoryTree } from "@/lib/categoryTree";
import type { Category } from "@/types/db";

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
}

// Mirrors supabase/migrations/0006_seed_catalogue.sql + 0008_hommes_category.sql
// — the site's category structure is fixed business taxonomy from the client
// brief, not content that changes shop to shop. Shown only when the live
// table comes back empty (DB not connected yet, or genuinely not seeded), so
// the nav and landing page never look broken before Supabase is wired up.
// Slugs match the migrations exactly, so links resolve correctly the moment
// real data replaces this fallback — synthetic `slug:` ids are fine since
// nothing here is written back to the database.
interface FallbackDef {
  slug: string;
  name_fr: string;
  name_ar: string;
  parentSlug: string | null;
  sort_order: number;
}

const FALLBACK_DEFS: FallbackDef[] = [
  { slug: "bijoux-argent-925", name_fr: "Bijoux en Argent 925", name_ar: "مجوهرات فضة 925", parentSlug: null, sort_order: 1 },
  { slug: "parures-argent", name_fr: "Parures", name_ar: "أطقم", parentSlug: "bijoux-argent-925", sort_order: 1 },
  { slug: "bagues-argent", name_fr: "Bagues", name_ar: "خواتم", parentSlug: "bijoux-argent-925", sort_order: 2 },
  { slug: "colliers-argent", name_fr: "Colliers", name_ar: "قلادات", parentSlug: "bijoux-argent-925", sort_order: 3 },
  { slug: "bracelets-argent", name_fr: "Bracelets", name_ar: "أساور", parentSlug: "bijoux-argent-925", sort_order: 4 },
  { slug: "gourmettes-argent", name_fr: "Gourmettes", name_ar: "غورميت", parentSlug: "bijoux-argent-925", sort_order: 5 },
  { slug: "boucles-argent", name_fr: "Boucles d'oreilles", name_ar: "أقراط", parentSlug: "bijoux-argent-925", sort_order: 6 },
  { slug: "pendentifs-argent", name_fr: "Pendentifs", name_ar: "دلايات", parentSlug: "bijoux-argent-925", sort_order: 7 },
  { slug: "chaines-argent", name_fr: "Chaînes", name_ar: "سلاسل", parentSlug: "bijoux-argent-925", sort_order: 8 },
  { slug: "hommes-argent", name_fr: "Hommes", name_ar: "رجالي", parentSlug: "bijoux-argent-925", sort_order: 9 },
  { slug: "colliers-hommes-argent", name_fr: "Colliers", name_ar: "قلادات", parentSlug: "hommes-argent", sort_order: 1 },
  { slug: "bagues-hommes-argent", name_fr: "Bagues", name_ar: "خواتم", parentSlug: "hommes-argent", sort_order: 2 },
  { slug: "gourmettes-hommes-argent", name_fr: "Gourmettes", name_ar: "غورميت", parentSlug: "hommes-argent", sort_order: 3 },

  { slug: "bijoux-acier-inox", name_fr: "Bijoux en Acier Inoxydable", name_ar: "مجوهرات ستانلس ستيل", parentSlug: null, sort_order: 2 },
  { slug: "parures-inox", name_fr: "Parures", name_ar: "أطقم", parentSlug: "bijoux-acier-inox", sort_order: 1 },
  { slug: "bagues-inox", name_fr: "Bagues", name_ar: "خواتم", parentSlug: "bijoux-acier-inox", sort_order: 2 },
  { slug: "bracelets-inox", name_fr: "Bracelets", name_ar: "أساور", parentSlug: "bijoux-acier-inox", sort_order: 3 },
  { slug: "gourmettes-inox", name_fr: "Gourmettes", name_ar: "غورميت", parentSlug: "bijoux-acier-inox", sort_order: 4 },
  { slug: "colliers-inox", name_fr: "Colliers", name_ar: "قلادات", parentSlug: "bijoux-acier-inox", sort_order: 5 },
  { slug: "boucles-inox", name_fr: "Boucles d'oreilles", name_ar: "أقراط", parentSlug: "bijoux-acier-inox", sort_order: 6 },

  { slug: "montres", name_fr: "Montres", name_ar: "ساعات", parentSlug: null, sort_order: 3 },
  { slug: "montres-femme", name_fr: "Montres Femme", name_ar: "ساعات نسائية", parentSlug: "montres", sort_order: 1 },
  { slug: "montres-homme", name_fr: "Montres Homme", name_ar: "ساعات رجالية", parentSlug: "montres", sort_order: 2 },

  { slug: "personnalisation", name_fr: "Personnalisation", name_ar: "تخصيص", parentSlug: null, sort_order: 4 },
  { slug: "gravure-laser", name_fr: "Gravure Laser", name_ar: "نقش بالليزر", parentSlug: "personnalisation", sort_order: 1 },
  { slug: "bijoux-personnalises", name_fr: "Bijoux Personnalisés", name_ar: "مجوهرات مخصصة", parentSlug: "personnalisation", sort_order: 2 },
];

const FALLBACK_CATEGORIES: Category[] = FALLBACK_DEFS.map((c) => ({
  id: `slug:${c.slug}`,
  slug: c.slug,
  name_fr: c.name_fr,
  name_ar: c.name_ar,
  description_fr: null,
  description_ar: null,
  image_url: null,
  sort_order: c.sort_order,
  created_at: "",
  parent_id: c.parentSlug ? `slug:${c.parentSlug}` : null,
}));

const FALLBACK_TREE = buildCategoryTree(FALLBACK_CATEGORIES);

export function useCategoryGroups() {
  const { data, ...rest } = useCategories();
  const tree = data && data.length > 0 ? buildCategoryTree(data) : FALLBACK_TREE;
  return { data: tree, ...rest };
}

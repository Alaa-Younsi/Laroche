import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types/db";

export interface CategoryGroup extends Category {
  children: Category[];
}

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

// Mirrors supabase/migrations/0006_seed_catalogue.sql — the site's category
// structure is fixed business taxonomy from the client brief, not content
// that changes shop to shop. Shown only when the live table comes back
// empty (DB not connected yet, or genuinely not seeded), so the nav and
// landing page never look broken before Supabase is wired up. Slugs match
// the migration exactly, so links resolve correctly the moment real data
// replaces this fallback — synthetic `slug:` ids are fine since nothing
// here is written back to the database.
const FALLBACK_GROUPS: CategoryGroup[] = [
  {
    id: "slug:bijoux-argent-925",
    slug: "bijoux-argent-925",
    name_fr: "Bijoux en Argent 925",
    name_ar: "مجوهرات فضة 925",
    description_fr: null,
    description_ar: null,
    image_url: null,
    sort_order: 1,
    created_at: "",
    parent_id: null,
    children: [
      { name_fr: "Parures", name_ar: "أطقم", slug: "parures-argent" },
      { name_fr: "Bagues", name_ar: "خواتم", slug: "bagues-argent" },
      { name_fr: "Colliers", name_ar: "قلادات", slug: "colliers-argent" },
      { name_fr: "Bracelets", name_ar: "أساور", slug: "bracelets-argent" },
      { name_fr: "Gourmettes", name_ar: "غورميت", slug: "gourmettes-argent" },
      { name_fr: "Boucles d'oreilles", name_ar: "أقراط", slug: "boucles-argent" },
      { name_fr: "Pendentifs", name_ar: "دلايات", slug: "pendentifs-argent" },
      { name_fr: "Chaînes", name_ar: "سلاسل", slug: "chaines-argent" },
    ].map((c, i) => ({ ...c, id: `slug:${c.slug}`, description_fr: null, description_ar: null, image_url: null, sort_order: i + 1, created_at: "", parent_id: "slug:bijoux-argent-925" })),
  },
  {
    id: "slug:bijoux-acier-inox",
    slug: "bijoux-acier-inox",
    name_fr: "Bijoux en Acier Inoxydable",
    name_ar: "مجوهرات ستانلس ستيل",
    description_fr: null,
    description_ar: null,
    image_url: null,
    sort_order: 2,
    created_at: "",
    parent_id: null,
    children: [
      { name_fr: "Parures", name_ar: "أطقم", slug: "parures-inox" },
      { name_fr: "Bagues", name_ar: "خواتم", slug: "bagues-inox" },
      { name_fr: "Bracelets", name_ar: "أساور", slug: "bracelets-inox" },
      { name_fr: "Gourmettes", name_ar: "غورميت", slug: "gourmettes-inox" },
      { name_fr: "Colliers", name_ar: "قلادات", slug: "colliers-inox" },
      { name_fr: "Boucles d'oreilles", name_ar: "أقراط", slug: "boucles-inox" },
    ].map((c, i) => ({ ...c, id: `slug:${c.slug}`, description_fr: null, description_ar: null, image_url: null, sort_order: i + 1, created_at: "", parent_id: "slug:bijoux-acier-inox" })),
  },
  {
    id: "slug:montres",
    slug: "montres",
    name_fr: "Montres",
    name_ar: "ساعات",
    description_fr: null,
    description_ar: null,
    image_url: null,
    sort_order: 3,
    created_at: "",
    parent_id: null,
    children: [
      { name_fr: "Montres Femme", name_ar: "ساعات نسائية", slug: "montres-femme" },
      { name_fr: "Montres Homme", name_ar: "ساعات رجالية", slug: "montres-homme" },
    ].map((c, i) => ({ ...c, id: `slug:${c.slug}`, description_fr: null, description_ar: null, image_url: null, sort_order: i + 1, created_at: "", parent_id: "slug:montres" })),
  },
  {
    id: "slug:personnalisation",
    slug: "personnalisation",
    name_fr: "Personnalisation",
    name_ar: "تخصيص",
    description_fr: null,
    description_ar: null,
    image_url: null,
    sort_order: 4,
    created_at: "",
    parent_id: null,
    children: [
      { name_fr: "Gravure Laser", name_ar: "نقش بالليزر", slug: "gravure-laser" },
      { name_fr: "Bijoux Personnalisés", name_ar: "مجوهرات مخصصة", slug: "bijoux-personnalises" },
    ].map((c, i) => ({ ...c, id: `slug:${c.slug}`, description_fr: null, description_ar: null, image_url: null, sort_order: i + 1, created_at: "", parent_id: "slug:personnalisation" })),
  },
];

export function useCategoryGroups() {
  const { data, ...rest } = useCategories();
  const groups: CategoryGroup[] = (data ?? [])
    .filter((c) => !c.parent_id)
    .map((parent) => ({
      ...parent,
      children: (data ?? []).filter((c) => c.parent_id === parent.id),
    }));
  return { data: groups.length > 0 ? groups : FALLBACK_GROUPS, ...rest };
}

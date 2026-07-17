import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategories } from "@/hooks/useCategories";
import { useProducts, type ProductFilters } from "@/hooks/useProducts";
import { useSeo } from "@/hooks/useSeo";
import { Select } from "@/components/ui/Select";
import { ProductCard } from "@/components/product/ProductCard";

export default function Shop() {
  const { t, lang } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categorySlug = params.get("categorie") ?? undefined;
  const collectionSlug = params.get("collection") ?? undefined;
  const search = params.get("q") ?? undefined;
  const sort = (params.get("tri") as ProductFilters["sort"]) ?? "newest";

  const { data: categories = [] } = useCategories();
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  const filters: ProductFilters = {
    categoryId: activeCategory?.id,
    collectionSlug,
    search,
    sort,
  };

  const { data: products = [], isLoading } = useProducts(filters);

  useSeo({
    title: `${t("shopTitle")} — Laroche Bijoux`,
    description: "Découvrez toute la collection Laroche Bijoux : argent 925, acier inoxydable, montres et personnalisation.",
  });

  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink md:text-4xl">
            {activeCategory
              ? lang === "ar"
                ? activeCategory.name_ar
                : activeCategory.name_fr
              : t("shopTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {products.length} {t("resultsCount")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-xs uppercase tracking-wide2 text-ink md:hidden"
          >
            <SlidersHorizontal size={14} /> {t("filterCategory")}
          </button>
          <Select
            value={sort}
            onChange={(e) => setParam("tri", e.target.value)}
            className="w-auto min-w-40"
          >
            <option value="newest">{t("sortNewest")}</option>
            <option value="price_asc">{t("sortPriceAsc")}</option>
            <option value="price_desc">{t("sortPriceDesc")}</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className={`space-y-6 md:block ${filtersOpen ? "block" : "hidden"}`}>
          <div className="flex items-center justify-between md:hidden">
            <h3 className="text-xs uppercase tracking-wide2 text-muted">{t("filterCategory")}</h3>
            <button onClick={() => setFiltersOpen(false)} aria-label={t("close")}>
              <X size={16} />
            </button>
          </div>

          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wide2 text-muted">
              {t("filterCategory")}
            </h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setParam("categorie", null)}
                  className={`block w-full rounded-lg px-3 py-2 text-start text-sm ${
                    !categorySlug ? "bg-panel-2 text-brand" : "text-muted hover:text-ink"
                  }`}
                >
                  {t("viewAll")}
                </button>
              </li>
              {parentCategories.map((parent) => (
                <li key={parent.id}>
                  <button
                    onClick={() => setParam("categorie", parent.slug)}
                    className={`block w-full rounded-lg px-3 py-2 text-start text-sm ${
                      categorySlug === parent.slug ? "bg-panel-2 text-brand" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "ar" ? parent.name_ar : parent.name_fr}
                  </button>
                  <ul className="ms-3 border-s border-line ps-2">
                    {categories
                      .filter((c) => c.parent_id === parent.id)
                      .map((child) => (
                        <li key={child.id}>
                          <button
                            onClick={() => setParam("categorie", child.slug)}
                            className={`block w-full rounded-lg px-3 py-1.5 text-start text-xs ${
                              categorySlug === child.slug
                                ? "text-brand"
                                : "text-muted hover:text-ink"
                            }`}
                          >
                            {lang === "ar" ? child.name_ar : child.name_fr}
                          </button>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          {(categorySlug || collectionSlug || search) && (
            <button
              onClick={() => setParams({})}
              className="text-xs uppercase tracking-wide2 text-brand hover:brightness-110"
            >
              {t("filterClear")}
            </button>
          )}
        </aside>

        <div>
          {isLoading ? (
            <p className="py-20 text-center text-muted">{t("loading")}</p>
          ) : products.length === 0 ? (
            <p className="py-20 text-center text-muted">{t("noResults")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

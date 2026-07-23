import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategoryGroups } from "@/hooks/useCategories";
import { useProducts, type ProductFilters } from "@/hooks/useProducts";
import { useSeo } from "@/hooks/useSeo";
import { Select } from "@/components/ui/Select";
import { ProductCard } from "@/components/product/ProductCard";
import { Reveal } from "@/components/effects/Reveal";
import { collectDescendantIds, findCategoryNodeBySlug, type CategoryNode } from "@/lib/categoryTree";
import { cn } from "@/lib/utils";

function CategoryTreeList({
  nodes,
  depth,
  activeSlug,
  lang,
  onSelect,
}: {
  nodes: CategoryNode[];
  depth: number;
  activeSlug: string | undefined;
  lang: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <ul className={depth === 0 ? "space-y-1" : "ms-3 border-s border-line ps-2"}>
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            onClick={() => onSelect(node.slug)}
            className={cn(
              "group flex w-full items-center text-start transition-colors",
              depth === 0 ? "px-3 py-2 text-sm" : "px-3 py-1.5 text-xs",
              activeSlug === node.slug ? "bg-panel-2 text-brand" : "text-muted hover:text-ink",
            )}
          >
            {depth === 0 && (
              <span className="inline-block h-px w-0 bg-brand transition-all duration-300 group-hover:me-2 group-hover:w-3" />
            )}
            {lang === "ar" ? node.name_ar : node.name_fr}
          </button>
          {node.children.length > 0 && (
            <CategoryTreeList
              nodes={node.children}
              depth={depth + 1}
              activeSlug={activeSlug}
              lang={lang}
              onSelect={onSelect}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Shop() {
  const { t, lang } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categorySlug = params.get("categorie") ?? undefined;
  const collectionSlug = params.get("collection") ?? undefined;
  const search = params.get("q") ?? undefined;
  const sort = (params.get("tri") as ProductFilters["sort"]) ?? "newest";

  const { data: categoryTree = [] } = useCategoryGroups();
  const activeNode = categorySlug ? findCategoryNodeBySlug(categoryTree, categorySlug) : undefined;

  const filters: ProductFilters = {
    categoryIds: activeNode ? collectDescendantIds(activeNode) : undefined,
    collectionSlug,
    search,
    sort,
  };

  const { data: products = [], isLoading } = useProducts(filters);

  useSeo({
    title: `${t("shopTitle")} — Laroche Bijoux`,
    description: "Découvrez toute la collection Laroche Bijoux : argent 925, acier inoxydable, montres et personnalisation.",
  });

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3"
        >
          <span className="flex items-center gap-3 text-[0.6rem] uppercase tracking-wide5 text-brand">
            <span className="fx-rule" />
            {t("shopTitle")}
          </span>
          <h1 className="font-display text-4xl font-light text-ink md:text-5xl">
            {activeNode
              ? lang === "ar"
                ? activeNode.name_ar
                : activeNode.name_fr
              : t("shopTitle")}
          </h1>
          <p className="text-xs uppercase tracking-wide2 text-muted">
            {products.length} {t("resultsCount")}
          </p>
        </motion.div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 border border-line px-5 py-2.5 text-[0.62rem] uppercase tracking-wide4 text-ink md:hidden"
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
                  className={`group flex w-full items-center px-3 py-2 text-start text-sm transition-colors ${
                    !categorySlug ? "bg-panel-2 text-brand" : "text-muted hover:text-ink"
                  }`}
                >
                  <span className="inline-block h-px w-0 bg-brand transition-all duration-300 group-hover:me-2 group-hover:w-3" />
                  {t("viewAll")}
                </button>
              </li>
            </ul>
            <CategoryTreeList
              nodes={categoryTree}
              depth={0}
              activeSlug={categorySlug}
              lang={lang}
              onSelect={(slug) => setParam("categorie", slug)}
            />
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
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <span className="animate-sparkle text-2xl text-brand">✦</span>
              <span className="text-xs uppercase tracking-wide3 text-muted">{t("loading")}</span>
            </div>
          ) : products.length === 0 ? (
            <p className="py-20 text-center text-muted">{t("noResults")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
              {products.map((product, i) => (
                <Reveal key={product.id} delay={(i % 2) * 0.07}>
                  <ProductCard product={product} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

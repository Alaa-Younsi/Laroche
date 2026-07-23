import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategoryGroups } from "@/hooks/useCategories";
import { useCollections, useBrands } from "@/hooks/useCollectionsAndBrands";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/utils";
import { flattenCategoryTree, type CategoryNode } from "@/lib/categoryTree";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

const DEPTH_INDENT = ["", "ms-6", "ms-12", "ms-[4.5rem]"] as const;

type Tab = "categories" | "collections" | "brands";

export default function Categories() {
  const { t, lang } = useLanguage();
  const [tab, setTab] = useState<Tab>("categories");

  const tabs: { key: Tab; label: string }[] = [
    { key: "categories", label: t("adminCategories") },
    { key: "collections", label: t("navCollections") },
    { key: "brands", label: t("navBrands") },
  ];

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-ink">{t("adminCategories")}</h1>

      <div className="mb-6 flex gap-2 border-b border-line">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm",
              tab === tb.key ? "border-brand text-brand" : "border-transparent text-muted",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "categories" && <CategoriesTab lang={lang} />}
      {tab === "collections" && <CollectionsTab lang={lang} />}
      {tab === "brands" && <BrandsTab />}
    </div>
  );
}

function CategoryNodeRow({
  node,
  depth,
  lang,
  onRemove,
}: {
  node: CategoryNode;
  depth: number;
  lang: string;
  onRemove: (id: string) => void;
}) {
  return (
    <BentoPanel className={cn("p-4", DEPTH_INDENT[Math.min(depth, DEPTH_INDENT.length - 1)])}>
      <div className="flex items-center justify-between">
        <span className={depth === 0 ? "font-medium text-ink" : "text-sm text-ink"}>
          {lang === "ar" ? node.name_ar : node.name_fr}
        </span>
        <button onClick={() => onRemove(node.id)} className="text-muted hover:text-red-500">
          <Trash2 size={15} />
        </button>
      </div>
      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <CategoryNodeRow key={child.id} node={child} depth={depth + 1} lang={lang} onRemove={onRemove} />
          ))}
        </div>
      )}
    </BentoPanel>
  );
}

function CategoriesTab({ lang }: { lang: string }) {
  const { t } = useLanguage();
  const { data: tree = [] } = useCategoryGroups();
  const queryClient = useQueryClient();
  const [nameFr, setNameFr] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState("");

  const flatOptions = flattenCategoryTree(tree);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nameFr.trim() || !nameAr.trim()) return;
    await supabase.from("categories").insert({
      slug: slugify(nameFr) + "-" + Math.random().toString(36).slice(2, 6),
      name_fr: nameFr.trim(),
      name_ar: nameAr.trim(),
      parent_id: parentId || null,
    });
    setNameFr("");
    setNameAr("");
    setParentId("");
    invalidate();
  }

  async function remove(id: string) {
    await supabase.from("categories").delete().eq("id", id);
    invalidate();
  }

  return (
    <div>
      <BentoPanel className="mb-6 p-6">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Nom (FR)" value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
          <Input placeholder="الاسم (AR)" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Catégorie principale —</option>
            {flatOptions.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {"— ".repeat(depth)}
                {lang === "ar" ? node.name_ar : node.name_fr}
              </option>
            ))}
          </Select>
          <Button type="submit">
            <Plus size={14} /> {t("add")}
          </Button>
        </form>
      </BentoPanel>

      <div className="space-y-2">
        {tree.map((node) => (
          <CategoryNodeRow key={node.id} node={node} depth={0} lang={lang} onRemove={remove} />
        ))}
      </div>
    </div>
  );
}

function CollectionsTab({ lang }: { lang: string }) {
  const { t } = useLanguage();
  const { data: collections = [] } = useCollections();
  const queryClient = useQueryClient();
  const [nameFr, setNameFr] = useState("");
  const [nameAr, setNameAr] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nameFr.trim() || !nameAr.trim()) return;
    await supabase.from("collections").insert({
      slug: slugify(nameFr) + "-" + Math.random().toString(36).slice(2, 6),
      name_fr: nameFr.trim(),
      name_ar: nameAr.trim(),
    });
    setNameFr("");
    setNameAr("");
    queryClient.invalidateQueries({ queryKey: ["collections"] });
  }

  async function remove(id: string) {
    await supabase.from("collections").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["collections"] });
  }

  return (
    <div>
      <BentoPanel className="mb-6 p-6">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Nom (FR)" value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
          <Input placeholder="الاسم (AR)" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          <Button type="submit">
            <Plus size={14} /> {t("add")}
          </Button>
        </form>
      </BentoPanel>

      <div className="flex flex-wrap gap-2">
        {collections.map((c) => (
          <span key={c.id} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-ink">
            {lang === "ar" ? c.name_ar : c.name_fr}
            <button onClick={() => remove(c.id)} className="text-muted hover:text-red-500">
              <Trash2 size={13} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function BrandsTab() {
  const { t } = useLanguage();
  const { data: brands = [] } = useBrands();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await supabase.from("brands").insert({
      slug: slugify(name) + "-" + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
    });
    setName("");
    queryClient.invalidateQueries({ queryKey: ["brands"] });
  }

  async function remove(id: string) {
    await supabase.from("brands").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["brands"] });
  }

  return (
    <div>
      <BentoPanel className="mb-6 p-6">
        <form onSubmit={add} className="flex gap-3">
          <Input placeholder="Nom de la marque" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit">
            <Plus size={14} /> {t("add")}
          </Button>
        </form>
      </BentoPanel>

      <div className="flex flex-wrap gap-2">
        {brands.map((b) => (
          <span key={b.id} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-ink">
            {b.name}
            <button onClick={() => remove(b.id)} className="text-muted hover:text-red-500">
              <Trash2 size={13} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

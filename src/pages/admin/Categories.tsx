import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategories } from "@/hooks/useCategories";
import { useCollections, useBrands } from "@/hooks/useCollectionsAndBrands";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/utils";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

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

function CategoriesTab({ lang }: { lang: string }) {
  const { t } = useLanguage();
  const { data: categories = [] } = useCategories();
  const queryClient = useQueryClient();
  const [nameFr, setNameFr] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState("");

  const parents = categories.filter((c) => !c.parent_id);

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
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {lang === "ar" ? p.name_ar : p.name_fr}
              </option>
            ))}
          </Select>
          <Button type="submit">
            <Plus size={14} /> {t("add")}
          </Button>
        </form>
      </BentoPanel>

      <div className="space-y-2">
        {parents.map((parent) => (
          <BentoPanel key={parent.id} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">
                {lang === "ar" ? parent.name_ar : parent.name_fr}
              </span>
              <button onClick={() => remove(parent.id)} className="text-muted hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories
                .filter((c) => c.parent_id === parent.id)
                .map((child) => (
                  <span
                    key={child.id}
                    className="flex items-center gap-2 rounded-full bg-panel-2 px-3 py-1.5 text-xs text-ink"
                  >
                    {lang === "ar" ? child.name_ar : child.name_fr}
                    <button onClick={() => remove(child.id)} className="text-muted hover:text-red-500">
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
            </div>
          </BentoPanel>
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

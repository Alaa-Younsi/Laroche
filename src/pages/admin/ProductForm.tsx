import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategoryGroups } from "@/hooks/useCategories";
import { useCollections, useBrands } from "@/hooks/useCollectionsAndBrands";
import { uniqueSlug } from "@/lib/utils";
import { flattenCategoryTree } from "@/lib/categoryTree";
import { sanitizeOffers } from "@/lib/sanitizeOffers";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipListEditor } from "@/components/admin/ChipListEditor";
import { ColorsEditor } from "@/components/admin/ColorsEditor";
import { CustomVariantsEditor } from "@/components/admin/CustomVariantsEditor";
import { OffersEditor } from "@/components/admin/OffersEditor";
import { ImagesEditor } from "@/components/admin/ImagesEditor";
import type { Product, ProductColor, ProductImage, VariantGroup, QuantityOffer } from "@/types/db";

const EMPTY: Omit<Product, "id" | "created_at" | "updated_at" | "category" | "product_images"> = {
  slug: "",
  name_fr: "",
  name_ar: "",
  description_fr: "",
  description_ar: "",
  details_fr: [],
  details_ar: [],
  price: 0,
  compare_at_price: null,
  category_id: "",
  stock: 0,
  style_code: null,
  material: null,
  warranty_fr: null,
  warranty_ar: null,
  colors: [],
  sizes: [],
  variants: [],
  quantity_offers: [],
  video_url: null,
  featured: false,
  status: "draft",
};

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: categoryTree = [] } = useCategoryGroups();
  const { data: collections = [] } = useCollections();
  const { data: brands = [] } = useBrands();

  const [form, setForm] = useState(EMPTY);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [brandId, setBrandId] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data: product } = await supabase
        .from("products")
        .select("*, product_images(*)")
        .eq("id", id)
        .single();
      if (product) {
        setForm(product);
        setImages((product.product_images ?? []).sort((a: ProductImage, b: ProductImage) => a.sort_order - b.sort_order));
      }
      const { data: link } = await supabase.from("products").select("brand_id").eq("id", id).single();
      if (link?.brand_id) setBrandId(link.brand_id);
      const { data: pc } = await supabase.from("product_collections").select("collection_id").eq("product_id", id);
      setCollectionIds((pc ?? []).map((r) => r.collection_id));
      setLoading(false);
    })();
  }, [id, isEdit]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let videoUrl = form.video_url;
    if (videoFile) {
      const path = `${crypto.randomUUID()}-${videoFile.name}`;
      const { data } = await supabase.storage
        .from("product-videos")
        .upload(path, videoFile, { cacheControl: "31536000" });
      if (data) {
        videoUrl = supabase.storage.from("product-videos").getPublicUrl(data.path).data.publicUrl;
      }
    }

    const slug = isEdit
      ? form.slug
      : await uniqueSlug(form.name_fr || form.name_ar, async (candidate) => {
          const { data } = await supabase.from("products").select("id").eq("slug", candidate).maybeSingle();
          return !!data;
        });

    const payload = {
      ...form,
      slug,
      video_url: videoUrl,
      brand_id: brandId || null,
      quantity_offers: sanitizeOffers(form.quantity_offers as QuantityOffer[]),
      variants: (form.variants as VariantGroup[]).filter((g) => g.name_fr.trim() && g.values.length > 0),
      colors: (form.colors as ProductColor[]).filter((c) => c.label_fr.trim() || c.label_ar.trim()),
      compare_at_price: form.compare_at_price || null,
    };

    let productId = id;
    if (isEdit) {
      await supabase.from("products").update(payload).eq("id", id);
    } else {
      const { data } = await supabase.from("products").insert(payload).select("id").single();
      productId = data?.id;
    }

    if (productId) {
      await supabase.from("product_images").delete().eq("product_id", productId);
      if (images.length > 0) {
        await supabase.from("product_images").insert(
          images.map((img, i) => ({
            product_id: productId,
            url: img.url,
            alt: img.alt,
            sort_order: i,
          })),
        );
      }

      await supabase.from("product_collections").delete().eq("product_id", productId);
      if (collectionIds.length > 0) {
        await supabase.from("product_collections").insert(
          collectionIds.map((collection_id) => ({ product_id: productId, collection_id })),
        );
      }
    }

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    navigate("/admin/produits");
  }

  if (loading) return <p className="text-muted">{t("loading")}</p>;

  return (
    <form onSubmit={handleSave}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">
          {isEdit ? t("adminEditProduct") : t("adminAddProduct")}
        </h1>
        <Button type="submit" disabled={saving}>
          {saving ? "…" : t("save")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <BentoPanel className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Nom (FR)" value={form.name_fr} onChange={(e) => update("name_fr", e.target.value)} required />
              <Input placeholder="الاسم (AR)" dir="rtl" value={form.name_ar} onChange={(e) => update("name_ar", e.target.value)} required />
            </div>
            <Textarea placeholder="Description (FR)" rows={4} value={form.description_fr} onChange={(e) => update("description_fr", e.target.value)} />
            <Textarea placeholder="الوصف (AR)" dir="rtl" rows={4} value={form.description_ar} onChange={(e) => update("description_ar", e.target.value)} />
          </BentoPanel>

          <BentoPanel className="p-6">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wide2 text-muted">Images</h3>
            <ImagesEditor images={images} onChange={setImages} />
          </BentoPanel>

          <BentoPanel className="p-6">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wide2 text-muted">{t("productVideo")}</h3>
            <Input
              placeholder="URL vidéo (YouTube, Cloudinary…)"
              value={form.video_url ?? ""}
              onChange={(e) => update("video_url", e.target.value)}
              className="mb-3"
            />
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted"
            />
          </BentoPanel>

          <BentoPanel className="space-y-4 p-6">
            <h3 className="text-sm font-medium uppercase tracking-wide2 text-muted">{t("productDetails")}</h3>
            <ChipListEditor values={form.details_fr} onChange={(v) => update("details_fr", v)} placeholder="Détail (FR)…" />
            <ChipListEditor values={form.details_ar} onChange={(v) => update("details_ar", v)} placeholder="تفصيل (AR)…" dir="rtl" />
          </BentoPanel>

          <BentoPanel className="space-y-4 p-6">
            <h3 className="text-sm font-medium uppercase tracking-wide2 text-muted">{t("productColor")}</h3>
            <ColorsEditor colors={form.colors} onChange={(v) => update("colors", v)} />
          </BentoPanel>

          <BentoPanel className="space-y-4 p-6">
            <h3 className="text-sm font-medium uppercase tracking-wide2 text-muted">{t("productSize")}</h3>
            <ChipListEditor values={form.sizes} onChange={(v) => update("sizes", v)} placeholder="Taille…" />
          </BentoPanel>

          <BentoPanel className="p-6">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wide2 text-muted">Variantes personnalisées</h3>
            <CustomVariantsEditor groups={form.variants} onChange={(v) => update("variants", v)} />
          </BentoPanel>

          <BentoPanel className="p-6">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wide2 text-muted">Offres quantité</h3>
            <OffersEditor offers={form.quantity_offers} onChange={(v) => update("quantity_offers", v)} />
          </BentoPanel>
        </div>

        <div className="space-y-6">
          <BentoPanel className="space-y-4 p-6">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">Prix (DA)</label>
              <Input type="number" min={0} value={form.price} onChange={(e) => update("price", Number(e.target.value))} required />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">Prix barré (DA)</label>
              <Input
                type="number"
                min={0}
                value={form.compare_at_price ?? ""}
                onChange={(e) => update("compare_at_price", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">{t("adminStock")}</label>
              <Input type="number" min={0} value={form.stock} onChange={(e) => update("stock", Number(e.target.value))} required />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">{t("productStyleCode")}</label>
              <Input value={form.style_code ?? ""} onChange={(e) => update("style_code", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">{t("productMaterial")}</label>
              <Input value={form.material ?? ""} onChange={(e) => update("material", e.target.value)} />
            </div>
          </BentoPanel>

          <BentoPanel className="space-y-4 p-6">
            <h3 className="text-sm font-medium uppercase tracking-wide2 text-muted">{t("productWarranty")}</h3>
            <Input placeholder="Garantie (FR)" value={form.warranty_fr ?? ""} onChange={(e) => update("warranty_fr", e.target.value)} />
            <Input placeholder="الضمان (AR)" dir="rtl" value={form.warranty_ar ?? ""} onChange={(e) => update("warranty_ar", e.target.value)} />
          </BentoPanel>

          <BentoPanel className="space-y-4 p-6">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">Catégorie</label>
              <Select value={form.category_id} onChange={(e) => update("category_id", e.target.value)} required>
                <option value="">—</option>
                {categoryTree.map((top) => (
                  <optgroup key={top.id} label={top.name_fr}>
                    {flattenCategoryTree(top.children)
                      .filter(({ node }) => node.children.length === 0)
                      .map(({ node, depth }) => (
                        <option key={node.id} value={node.id}>
                          {"— ".repeat(depth)}
                          {node.name_fr}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">{t("navBrands")}</label>
              <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">—</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          </BentoPanel>

          <BentoPanel className="p-6">
            <label className="mb-2 block text-xs uppercase tracking-wide2 text-muted">{t("navCollections")}</label>
            <div className="flex flex-wrap gap-2">
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setCollectionIds((prev) =>
                      prev.includes(c.id) ? prev.filter((v) => v !== c.id) : [...prev, c.id],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    collectionIds.includes(c.id)
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line text-muted hover:border-brand/50"
                  }`}
                >
                  {c.name_fr}
                </button>
              ))}
            </div>
          </BentoPanel>

          <BentoPanel className="space-y-3 p-6">
            <label className="flex items-center justify-between text-sm text-ink">
              {t("adminActive")}
              <input
                type="checkbox"
                checked={form.status === "active"}
                onChange={(e) => update("status", e.target.checked ? "active" : "draft")}
                className="h-5 w-5 accent-[rgb(var(--c-brand))]"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-ink">
              {t("productBestSeller")}
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => update("featured", e.target.checked)}
                className="h-5 w-5 accent-[rgb(var(--c-brand))]"
              />
            </label>
          </BentoPanel>
        </div>
      </div>
    </form>
  );
}

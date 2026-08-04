import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategoryGroups } from "@/hooks/useCategories";
import { useCollections, useBrands } from "@/hooks/useCollectionsAndBrands";
import { uniqueSlug } from "@/lib/utils";
import { flattenCategoryTree } from "@/lib/categoryTree";
import { sanitizeOffers } from "@/lib/sanitizeOffers";
import { isPlayableVideoUrl } from "@/lib/video";
import { invalidateProductCaches } from "@/lib/queryCache";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipListEditor } from "@/components/admin/ChipListEditor";
import { ColorsEditor } from "@/components/admin/ColorsEditor";
import { CustomVariantsEditor } from "@/components/admin/CustomVariantsEditor";
import { OffersEditor } from "@/components/admin/OffersEditor";
import { ImagesEditor } from "@/components/admin/ImagesEditor";
import { useAdminToast } from "@/components/admin/AdminToast";
import type { Product, ProductColor, ProductImage, VariantGroup, QuantityOffer } from "@/types/db";

type ProductFormState = Omit<
  Product,
  "id" | "created_at" | "updated_at" | "category" | "product_images"
>;

const EMPTY: ProductFormState = {
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

// Keep the editable columns and everything else the row carries strictly
// apart. `select("*, product_images(*)")` hands back the generated columns
// (id, created_at, updated_at) AND the embedded product_images array; feeding
// that straight into the write payload made PostgREST reject the whole UPDATE
// ("Could not find the 'product_images' column of 'products'"), so every edit
// silently did nothing. Copying field by field means a future column added to
// the SELECT can never leak into a write again.
function toFormState(row: Product): ProductFormState {
  return {
    slug: row.slug,
    name_fr: row.name_fr,
    name_ar: row.name_ar,
    description_fr: row.description_fr ?? "",
    description_ar: row.description_ar ?? "",
    details_fr: row.details_fr ?? [],
    details_ar: row.details_ar ?? [],
    price: row.price,
    compare_at_price: row.compare_at_price,
    category_id: row.category_id ?? "",
    stock: row.stock,
    style_code: row.style_code,
    material: row.material,
    warranty_fr: row.warranty_fr,
    warranty_ar: row.warranty_ar,
    colors: row.colors ?? [],
    sizes: row.sizes ?? [],
    variants: row.variants ?? [],
    quantity_offers: row.quantity_offers ?? [],
    video_url: row.video_url,
    featured: row.featured,
    status: row.status,
  };
}

/** Full replace of a product's gallery rows. False if any leg was refused. */
async function replaceProductImages(productId: string, images: ProductImage[]): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", productId);
  if (deleteError) return false;
  if (images.length === 0) return true;

  const { error } = await supabase.from("product_images").insert(
    images.map((img, i) => ({
      product_id: productId,
      url: img.url,
      alt: img.alt,
      sort_order: i,
    })),
  );
  return !error;
}

/** Full replace of a product's collection links. False if any leg was refused. */
async function replaceProductCollections(
  productId: string,
  collectionIds: string[],
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("product_collections")
    .delete()
    .eq("product_id", productId);
  if (deleteError) return false;
  if (collectionIds.length === 0) return true;

  const { error } = await supabase
    .from("product_collections")
    .insert(collectionIds.map((collection_id) => ({ product_id: productId, collection_id })));
  return !error;
}

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const toast = useAdminToast();
  const { data: categoryTree = [] } = useCategoryGroups();
  const { data: collections = [] } = useCollections();
  const { data: brands = [] } = useBrands();

  const [form, setForm] = useState(EMPTY);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [brandId, setBrandId] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data: product, error } = await supabase
        .from("products")
        .select("*, product_images(*)")
        .eq("id", id)
        .single();

      // Editing a row we never loaded would save a blank form over it, so a
      // failed load has to stop the form rather than fall through to EMPTY.
      if (error || !product) {
        toast.error(t("adminLoadError"));
        setLoadFailed(true);
        setLoading(false);
        return;
      }

      setForm(toFormState(product as Product));
      setImages(
        ((product.product_images ?? []) as ProductImage[])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order),
      );
      setBrandId(product.brand_id ?? "");

      const { data: pc, error: pcError } = await supabase
        .from("product_collections")
        .select("collection_id")
        .eq("product_id", id);
      if (pcError) toast.error(t("adminLoadError"));
      setCollectionIds((pc ?? []).map((r) => r.collection_id));
      setLoading(false);
    })();
    // `toast` and `t` are stable for the life of the page; re-running this on
    // an identity change would refetch and stomp unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // Flagged, not blocked: the field is optional and a bad link only costs the
  // player, so the save still goes through — the admin just gets told why the
  // clip won't appear on the product page.
  const videoUrlInvalid = !!form.video_url?.trim() && !isPlayableVideoUrl(form.video_url);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let videoUrl = form.video_url;
    if (videoFile) {
      const path = `${crypto.randomUUID()}-${videoFile.name}`;
      const { data, error } = await supabase.storage
        .from("product-videos")
        .upload(path, videoFile, { cacheControl: "31536000" });
      // Saving on regardless would quietly drop the clip the admin just picked
      // — better to stop and let them retry than to "succeed" without it.
      if (error || !data) {
        toast.error(t("adminVideoUploadError"));
        setSaving(false);
        return;
      }
      videoUrl = supabase.storage.from("product-videos").getPublicUrl(data.path).data.publicUrl;
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

    let productId: string;
    if (isEdit && id) {
      const { error } = await supabase.from("products").update(payload).eq("id", id);
      if (error) {
        toast.error(t("adminSaveError"));
        setSaving(false);
        return;
      }
      productId = id;
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error || !data) {
        toast.error(t("adminSaveError"));
        setSaving(false);
        return;
      }
      productId = data.id;
    }

    // Images and collections are stored as a full replace. The product row is
    // saved by this point, so a failure here has to be reported and the form
    // kept open — leaving would hide that the gallery is now out of sync.
    const linksSaved =
      (await replaceProductImages(productId, images)) &&
      (await replaceProductCollections(productId, collectionIds));

    if (!linksSaved) {
      toast.error(t("adminSaveError"));
      setSaving(false);
      invalidateProductCaches(queryClient);
      return;
    }

    setSaving(false);
    invalidateProductCaches(queryClient);
    toast.success(t("adminSaved"));
    navigate("/admin/produits");
  }

  if (loading) return <p className="text-muted">{t("loading")}</p>;
  if (loadFailed) return <p className="text-red-500">{t("adminLoadError")}</p>;

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
            <h3 className="mb-2 text-sm font-medium uppercase tracking-wide2 text-muted">{t("productVideo")}</h3>
            <p className="mb-3 text-xs text-muted">{t("productVideoHint")}</p>
            <Input
              placeholder="https://…/video.mp4"
              value={form.video_url ?? ""}
              onChange={(e) => update("video_url", e.target.value)}
              className="mb-3"
            />
            {videoUrlInvalid && (
              <p className="mb-3 flex items-start gap-2 text-xs text-red-500">
                <AlertTriangle size={14} className="mt-px shrink-0" />
                {t("productVideoInvalid")}
              </p>
            )}
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

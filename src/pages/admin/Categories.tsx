import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Check, X, AlertTriangle, ImagePlus, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategoryGroups } from "@/hooks/useCategories";
import { useCollections, useBrands } from "@/hooks/useCollectionsAndBrands";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import { slugify } from "@/lib/utils";
import {
  flattenCategoryTree,
  findCategoryNode,
  collectDescendantIds,
  type CategoryNode,
} from "@/lib/categoryTree";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAdminToast } from "@/components/admin/AdminToast";
import { invalidateTaxonomyCaches } from "@/lib/queryCache";
import { cn } from "@/lib/utils";

const DEPTH_INDENT = ["", "ms-6", "ms-12", "ms-[4.5rem]"] as const;

type Tab = "categories" | "collections" | "brands";

// Categories rendered from the FALLBACK_TREE in useCategories carry synthetic
// `slug:` ids — there is no row behind them, so any write silently no-ops.
const isPersisted = (id: string) => !id.startsWith("slug:");

// The category photo is what the landing page shows on its category cards
// (Landing.tsx falls back to a stock editorial shot when image_url is null).
// It saves on pick rather than behind the edit form, so swapping a photo is a
// single click — same interaction as the colour swatches in ColorsEditor.
function CategoryImagePicker({
  imageUrl,
  onChange,
}: {
  imageUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const path = `categories/${crypto.randomUUID()}-${compressed.name}`;
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(path, compressed, { cacheControl: "31536000" });
    if (error || !data) {
      toast.error(t("adminUploadError"));
    } else {
      onChange(supabase.storage.from("product-images").getPublicUrl(data.path).data.publicUrl);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {imageUrl ? (
        <div className="group relative h-11 w-11 overflow-hidden rounded-lg border border-line">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-white/80 hover:text-white"
              title={t("categoryImageReplace")}
              aria-label={t("categoryImageReplace")}
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-white/80 hover:text-white"
              title={t("categoryImageRemove")}
              aria-label={t("categoryImageRemove")}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-line text-muted hover:border-brand hover:text-brand disabled:opacity-50"
          title={t("categoryImageAdd")}
          aria-label={t("categoryImageAdd")}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
        </button>
      )}
    </div>
  );
}

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

// A single category row. Toggles between a read view (name + edit/delete
// buttons) and an inline edit form (FR/AR names + parent picker).
function CategoryNodeRow({
  node,
  depth,
  lang,
  tree,
  editingId,
  onEdit,
  onCancelEdit,
  onSave,
  onSaveImage,
  onRemove,
}: {
  node: CategoryNode;
  depth: number;
  lang: string;
  tree: CategoryNode[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSave: (id: string, values: { name_fr: string; name_ar: string; parent_id: string | null }) => void;
  onSaveImage: (id: string, url: string | null) => void;
  onRemove: (node: CategoryNode) => void;
}) {
  const isEditing = editingId === node.id;

  return (
    <BentoPanel className={cn("p-4", DEPTH_INDENT[Math.min(depth, DEPTH_INDENT.length - 1)])}>
      {isEditing ? (
        <CategoryEditForm
          node={node}
          lang={lang}
          tree={tree}
          onCancel={onCancelEdit}
          onSave={(values) => onSave(node.id, values)}
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {isPersisted(node.id) && (
              <CategoryImagePicker
                imageUrl={node.image_url}
                onChange={(url) => onSaveImage(node.id, url)}
              />
            )}
            <span className={depth === 0 ? "font-medium text-ink" : "text-sm text-ink"}>
              {lang === "ar" ? node.name_ar : node.name_fr}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onEdit(node.id)}
              className="text-muted hover:text-brand"
              aria-label="edit"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => onRemove(node)}
              className="text-muted hover:text-red-500"
              aria-label="delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}

      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <CategoryNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              lang={lang}
              tree={tree}
              editingId={editingId}
              onEdit={onEdit}
              onCancelEdit={onCancelEdit}
              onSave={onSave}
              onSaveImage={onSaveImage}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </BentoPanel>
  );
}

function CategoryEditForm({
  node,
  lang,
  tree,
  onCancel,
  onSave,
}: {
  node: CategoryNode;
  lang: string;
  tree: CategoryNode[];
  onCancel: () => void;
  onSave: (values: { name_fr: string; name_ar: string; parent_id: string | null }) => void;
}) {
  const [nameFr, setNameFr] = useState(node.name_fr);
  const [nameAr, setNameAr] = useState(node.name_ar);
  const [parentId, setParentId] = useState(node.parent_id ?? "");

  // A category can't become its own parent or a child of one of its own
  // descendants (that would create a cycle) — exclude the whole subtree.
  const self = findCategoryNode(tree, node.id);
  const excluded = new Set(self ? collectDescendantIds(self) : [node.id]);
  const parentOptions = flattenCategoryTree(tree).filter(({ node: n }) => !excluded.has(n.id));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameFr.trim() || !nameAr.trim()) return;
    onSave({
      name_fr: nameFr.trim(),
      name_ar: nameAr.trim(),
      parent_id: parentId || null,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
      <Input placeholder="Nom (FR)" value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
      <Input placeholder="الاسم (AR)" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
      <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
        <option value="">— Catégorie principale —</option>
        {parentOptions.map(({ node: n, depth }) => (
          <option key={n.id} value={n.id}>
            {"— ".repeat(depth)}
            {lang === "ar" ? n.name_ar : n.name_fr}
          </option>
        ))}
      </Select>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" aria-label="save">
          <Check size={14} />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} aria-label="cancel">
          <X size={14} />
        </Button>
      </div>
    </form>
  );
}

// Confirmation before deleting a category — deletion cascades to every
// sub-category (categories.parent_id is ON DELETE CASCADE), so we spell out
// exactly how many children will disappear before the user commits.
function DeleteCategoryModal({
  node,
  lang,
  onConfirm,
  onCancel,
}: {
  node: CategoryNode;
  lang: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const descendantCount = collectDescendantIds(node).length - 1;
  const name = lang === "ar" ? node.name_ar : node.name_fr;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <BentoPanel className="w-full max-w-md p-6" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle size={18} />
          </span>
          <h3 className="font-display text-lg text-ink">{t("categoryDeleteTitle")}</h3>
        </div>
        <p className="text-sm text-muted">
          {t("categoryDeleteConfirm").replace("{name}", name)}
          {descendantCount > 0 && (
            <span className="mt-2 block font-medium text-red-500">
              {t("categoryDeleteCascade").replace("{count}", String(descendantCount))}
            </span>
          )}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button size="sm" variant="danger" onClick={onConfirm}>
            {t("delete")}
          </Button>
        </div>
      </BentoPanel>
    </div>
  );
}

function CategoriesTab({ lang }: { lang: string }) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: tree = [] } = useCategoryGroups();
  const queryClient = useQueryClient();
  const [nameFr, setNameFr] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryNode | null>(null);

  const flatOptions = flattenCategoryTree(tree);

  function invalidate() {
    invalidateTaxonomyCaches(queryClient);
  }

  // A row from FALLBACK_TREE has no database row behind it, and its synthetic
  // `slug:` id isn't even a valid uuid — writing to one can only fail. Say so
  // instead of firing a request that comes back with a cast error.
  function rejectFallback(id: string): boolean {
    if (isPersisted(id)) return false;
    toast.error(t("adminCategoryNotSaved"));
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nameFr.trim() || !nameAr.trim()) return;
    const parent = parentId || null;
    if (parent && rejectFallback(parent)) return;

    const { error } = await supabase.from("categories").insert({
      slug: slugify(nameFr) + "-" + Math.random().toString(36).slice(2, 6),
      name_fr: nameFr.trim(),
      name_ar: nameAr.trim(),
      parent_id: parent,
    });
    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }

    setNameFr("");
    setNameAr("");
    setParentId("");
    invalidate();
  }

  async function save(
    id: string,
    values: { name_fr: string; name_ar: string; parent_id: string | null },
  ) {
    if (rejectFallback(id)) return;
    if (values.parent_id && rejectFallback(values.parent_id)) return;

    const { error } = await supabase.from("categories").update(values).eq("id", id);
    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    setEditingId(null);
    invalidate();
  }

  async function saveImage(id: string, image_url: string | null) {
    if (rejectFallback(id)) return;
    const { error } = await supabase.from("categories").update({ image_url }).eq("id", id);
    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    invalidate();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (rejectFallback(pendingDelete.id)) {
      setPendingDelete(null);
      return;
    }

    const { error } = await supabase.from("categories").delete().eq("id", pendingDelete.id);
    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    setPendingDelete(null);
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

      <p className="mb-3 text-xs text-muted">{t("categoryImageHint")}</p>

      <div className="space-y-2">
        {tree.map((node) => (
          <CategoryNodeRow
            key={node.id}
            node={node}
            depth={0}
            lang={lang}
            tree={tree}
            editingId={editingId}
            onEdit={setEditingId}
            onCancelEdit={() => setEditingId(null)}
            onSave={save}
            onSaveImage={saveImage}
            onRemove={setPendingDelete}
          />
        ))}
      </div>

      {pendingDelete && (
        <DeleteCategoryModal
          node={pendingDelete}
          lang={lang}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function CollectionsTab({ lang }: { lang: string }) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: collections = [] } = useCollections();
  const queryClient = useQueryClient();
  const [nameFr, setNameFr] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFr, setEditFr] = useState("");
  const [editAr, setEditAr] = useState("");

  function invalidate() {
    invalidateTaxonomyCaches(queryClient);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nameFr.trim() || !nameAr.trim()) return;
    const { error } = await supabase.from("collections").insert({
      slug: slugify(nameFr) + "-" + Math.random().toString(36).slice(2, 6),
      name_fr: nameFr.trim(),
      name_ar: nameAr.trim(),
    });
    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    setNameFr("");
    setNameAr("");
    invalidate();
  }

  function startEdit(id: string, fr: string, ar: string) {
    setEditingId(id);
    setEditFr(fr);
    setEditAr(ar);
  }

  async function saveEdit(id: string) {
    if (!editFr.trim() || !editAr.trim()) return;
    const { error } = await supabase
      .from("collections")
      .update({ name_fr: editFr.trim(), name_ar: editAr.trim() })
      .eq("id", id);
    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    setEditingId(null);
    invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    invalidate();
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

      <div className="space-y-2">
        {collections.map((c) =>
          editingId === c.id ? (
            <BentoPanel key={c.id} className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Input value={editFr} onChange={(e) => setEditFr(e.target.value)} />
                <Input value={editAr} dir="rtl" onChange={(e) => setEditAr(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => saveEdit(c.id)} aria-label="save">
                    <Check size={14} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} aria-label="cancel">
                    <X size={14} />
                  </Button>
                </div>
              </div>
            </BentoPanel>
          ) : (
            <BentoPanel key={c.id} className="flex items-center justify-between p-4">
              <span className="text-sm text-ink">{lang === "ar" ? c.name_ar : c.name_fr}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => startEdit(c.id, c.name_fr, c.name_ar)}
                  className="text-muted hover:text-brand"
                  aria-label="edit"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(c.id)} className="text-muted hover:text-red-500" aria-label="delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </BentoPanel>
          ),
        )}
      </div>
    </div>
  );
}

function BrandsTab() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: brands = [] } = useBrands();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function invalidate() {
    invalidateTaxonomyCaches(queryClient);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("brands").insert({
      slug: slugify(name) + "-" + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
    });
    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    setName("");
    invalidate();
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    const { error } = await supabase.from("brands").update({ name: editName.trim() }).eq("id", id);
    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    setEditingId(null);
    invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    invalidate();
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

      <div className="space-y-2">
        {brands.map((b) =>
          editingId === b.id ? (
            <BentoPanel key={b.id} className="p-4">
              <div className="flex gap-3">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Button size="sm" onClick={() => saveEdit(b.id)} aria-label="save">
                  <Check size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} aria-label="cancel">
                  <X size={14} />
                </Button>
              </div>
            </BentoPanel>
          ) : (
            <BentoPanel key={b.id} className="flex items-center justify-between p-4">
              <span className="text-sm text-ink">{b.name}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditingId(b.id);
                    setEditName(b.name);
                  }}
                  className="text-muted hover:text-brand"
                  aria-label="edit"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(b.id)} className="text-muted hover:text-red-500" aria-label="delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </BentoPanel>
          ),
        )}
      </div>
    </div>
  );
}

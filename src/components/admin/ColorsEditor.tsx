import { useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { Input } from "@/components/ui/Input";
import type { ProductColor } from "@/types/db";

const DEFAULT_HEX = "#C0C0C0";

export function ColorsEditor({
  colors,
  onChange,
}: {
  colors: ProductColor[];
  onChange: (next: ProductColor[]) => void;
}) {
  function update(index: number, patch: Partial<ProductColor>) {
    onChange(colors.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function add() {
    onChange([...colors, { label_fr: "", label_ar: "", hex: DEFAULT_HEX, image_url: null }]);
  }

  function remove(index: number) {
    onChange(colors.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {colors.map((c, i) => (
        <ColorRow key={i} color={c} onChange={(patch) => update(i, patch)} onRemove={() => remove(i)} />
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted hover:border-brand hover:text-brand"
      >
        <Plus size={14} /> Ajouter une couleur
      </button>
    </div>
  );
}

function ColorRow({
  color,
  onChange,
  onRemove,
}: {
  color: ProductColor;
  onChange: (patch: Partial<ProductColor>) => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const path = `colors/${crypto.randomUUID()}-${compressed.name}`;
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(path, compressed, { cacheControl: "31536000" });
    if (error || !data) {
      toast.error(t("adminUploadError"));
    } else {
      const url = supabase.storage.from("product-images").getPublicUrl(data.path).data.publicUrl;
      onChange({ image_url: url });
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(color.hex) ? color.hex : DEFAULT_HEX}
          onChange={(e) => onChange({ hex: e.target.value })}
          className="h-11 w-11 cursor-pointer rounded-full border border-line bg-transparent p-0"
          title="Couleur"
        />
        <div className="w-24">
          <Input value={color.hex} onChange={(e) => onChange({ hex: e.target.value })} placeholder={DEFAULT_HEX} />
        </div>
      </div>

      <div className="flex min-w-[14rem] flex-1 gap-2">
        <Input
          value={color.label_fr}
          onChange={(e) => onChange({ label_fr: e.target.value })}
          placeholder="Nom (FR)"
        />
        <Input
          dir="rtl"
          value={color.label_ar}
          onChange={(e) => onChange({ label_ar: e.target.value })}
          placeholder="الاسم (AR)"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {color.image_url ? (
          <div className="group relative h-11 w-11 overflow-hidden rounded-lg border border-line">
            <img src={color.image_url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange({ image_url: null })}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Retirer la photo"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-line text-muted hover:border-brand hover:text-brand"
            title="Photo de cette couleur"
          >
            <Plus size={16} />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        <button type="button" onClick={onRemove} className="text-muted hover:text-red-500" aria-label="Supprimer">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

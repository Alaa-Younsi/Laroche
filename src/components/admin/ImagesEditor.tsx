import { useRef, useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import type { ProductImage } from "@/types/db";

export function ImagesEditor({
  images,
  onChange,
}: {
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    const uploaded: ProductImage[] = [];
    let failed = 0;
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file);
      const path = `${crypto.randomUUID()}-${compressed.name}`;
      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(path, compressed, { cacheControl: "31536000" });
      if (error || !data) {
        failed++;
        continue;
      }
      const url = supabase.storage.from("product-images").getPublicUrl(data.path).data.publicUrl;
      uploaded.push({
        id: crypto.randomUUID(),
        product_id: "",
        url,
        alt: null,
        sort_order: images.length + uploaded.length,
      });
    }

    // Keep whatever did upload — dropping the successful ones because one file
    // failed would be worse — but never let a silent gap in the batch pass.
    if (uploaded.length > 0) onChange([...images, ...uploaded]);
    if (failed > 0) toast.error(t("adminUploadError"));
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(id: string) {
    onChange(images.filter((img) => img.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...images];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((img, i) => ({ ...img, sort_order: i })));
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {images.map((img, i) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => remove(img.id)} className="text-white">
                <Trash2 size={16} />
              </button>
              <div className="flex gap-1 text-white">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>
                  <GripVertical size={14} className="rotate-90" />
                </button>
              </div>
            </div>
            {i === 0 && (
              <span className="absolute start-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[0.55rem] text-brand-ink">
                Principale
              </span>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-muted hover:border-brand hover:text-brand"
        >
          <Plus size={20} />
          <span className="text-[0.65rem]">{uploading ? "…" : "Ajouter"}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

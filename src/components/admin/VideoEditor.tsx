import { useRef, useState } from "react";
import { AlertTriangle, Trash2, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compressVideo, isPlayableVideoUrl, normalizeVideoUrl } from "@/lib/video";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { Input } from "@/components/ui/Input";

/**
 * One product's video: an uploaded file (compressed client-side, then stored
 * in the `product-videos` bucket) or a pasted direct link. Both land in the
 * same `video_url` column — the storefront (ProductVideo in Product.tsx)
 * doesn't care which it was, only that it resolves to a playable file.
 *
 * Uploads immediately on file selection rather than deferring to the
 * product's own Save, mirroring ImagesEditor: the admin sees the compressed
 * result (and its size) right away instead of finding out at save time that
 * the clip they picked ten minutes ago never made it in.
 */
export function VideoEditor({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const invalid = !!value?.trim() && !isPlayableVideoUrl(value);

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    try {
      const compressed = await compressVideo(file, setProgress);
      const path = `${crypto.randomUUID()}-${compressed.name}`;
      const { data, error } = await supabase.storage
        .from("product-videos")
        .upload(path, compressed, { cacheControl: "31536000" });
      if (error || !data) {
        toast.error(t("adminVideoUploadError"));
        return;
      }
      const url = supabase.storage.from("product-videos").getPublicUrl(data.path).data.publicUrl;
      onChange(url);
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <Input
        placeholder="https://…/video.mp4"
        value={value ?? ""}
        onChange={(e) => onChange(normalizeVideoUrl(e.target.value) || null)}
        className="mb-3"
        disabled={busy}
      />

      {invalid && (
        <p className="mb-3 flex items-start gap-2 text-xs text-red-500">
          <AlertTriangle size={14} className="mt-px shrink-0" />
          {t("productVideoInvalid")}
        </p>
      )}

      {value && !invalid && (
        <video
          src={value}
          controls
          muted
          className="mb-3 max-h-64 w-full rounded-lg border border-line bg-black object-contain"
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted hover:border-brand hover:text-brand disabled:opacity-60"
        >
          <UploadCloud size={14} />
          {busy ? `${t("adminVideoCompressing")} ${Math.round(progress * 100)}%` : t("adminVideoChooseFile")}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:underline disabled:opacity-60"
          >
            <Trash2 size={14} />
            {t("adminVideoRemove")}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

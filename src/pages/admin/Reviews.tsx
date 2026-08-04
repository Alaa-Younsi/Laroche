import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Star, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useReviews } from "@/hooks/useReviews";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import { useAdminToast } from "@/components/admin/AdminToast";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export default function Reviews() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: reviews = [], isLoading } = useReviews(false);
  const queryClient = useQueryClient();

  const [clientName, setClientName] = useState("");
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["reviews"] });
  }

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !text.trim()) return;
    setSubmitting(true);

    let image_url: string | null = null;
    if (file) {
      const compressed = await compressImage(file);
      const path = `${crypto.randomUUID()}-${compressed.name}`;
      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(path, compressed, { cacheControl: "31536000" });
      // The photo is the point of a review card — don't save a text-only row
      // as if the upload had worked.
      if (error || !data) {
        toast.error(t("adminUploadError"));
        setSubmitting(false);
        return;
      }
      image_url = supabase.storage.from("product-images").getPublicUrl(data.path).data.publicUrl;
    }

    const { error } = await supabase.from("client_reviews").insert({
      client_name: clientName.trim(),
      stars,
      review_text: text.trim(),
      image_url,
      active: true,
    });
    if (error) {
      toast.error(t("adminSaveError"));
      setSubmitting(false);
      return;
    }

    setClientName("");
    setText("");
    setStars(5);
    setFile(null);
    // Clearing the state doesn't clear the input's own value — without this the
    // form still shows the previous filename and re-submits the same photo.
    if (fileRef.current) fileRef.current.value = "";
    setSubmitting(false);
    invalidate();
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("client_reviews").update({ active: !active }).eq("id", id);
    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("client_reviews").delete().eq("id", id);
    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    invalidate();
  }

  return (
    <div>
      <h1 className="mb-8 font-display text-3xl text-ink">{t("adminReviews")}</h1>

      <BentoPanel className="mb-6 p-6">
        <form onSubmit={addReview} className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Nom du client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setStars(n)}>
                <Star size={20} className={n <= stars ? "fill-brand text-brand" : "text-line"} />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Avis du client"
            className="md:col-span-2"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted"
          />
          <Button type="submit" disabled={submitting} className="justify-self-start">
            <Plus size={14} /> {t("add")}
          </Button>
        </form>
      </BentoPanel>

      <div className="grid gap-4 md:grid-cols-2">
        {reviews.map((review) => (
          <BentoPanel key={review.id} className={cn("p-5", !review.active && "opacity-50")}>
            <div className="flex items-start justify-between">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className={i < review.stars ? "fill-brand text-brand" : "text-line"}
                  />
                ))}
              </div>
              <button onClick={() => remove(review.id)} className="text-muted hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">"{review.review_text}"</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide2 text-ink">
                {review.client_name}
              </span>
              <button
                onClick={() => toggleActive(review.id, review.active)}
                className={cn(
                  "rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-wide",
                  review.active ? "bg-brand/10 text-brand" : "bg-panel-2 text-muted",
                )}
              >
                {review.active ? t("adminActive") : t("adminDraft")}
              </button>
            </div>
          </BentoPanel>
        ))}
        {reviews.length === 0 && !isLoading && (
          <p className="text-muted">{t("adminNoOrders")}</p>
        )}
      </div>
    </div>
  );
}

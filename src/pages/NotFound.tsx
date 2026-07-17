import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/hooks/useSeo";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  const { t } = useLanguage();

  useSeo({ title: "404 — Laroche Bijoux", description: "Page introuvable." });

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <h1 className="font-display text-6xl text-brand">404</h1>
      <p className="text-muted">{t("noResults")}</p>
      <Button asChild>
        <Link to="/">{t("orderConfirmedBackHome")}</Link>
      </Button>
    </div>
  );
}

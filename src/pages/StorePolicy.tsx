import { Truck, RotateCcw, Wallet, MessageCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/hooks/useSeo";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Reveal } from "@/components/effects/Reveal";

export default function StorePolicy() {
  const { t } = useLanguage();

  useSeo({
    title: `${t("storePolicyTitle")} — Laroche Bijoux`,
    description: t("storePolicyIntro"),
  });

  const sections = [
    { icon: Truck, title: t("storePolicyDeliveryTitle"), text: t("storePolicyDeliveryText") },
    { icon: RotateCcw, title: t("storePolicyReturnsTitle"), text: t("storePolicyReturnsText") },
    { icon: Wallet, title: t("storePolicyRefundTitle"), text: t("storePolicyRefundText") },
    { icon: MessageCircle, title: t("storePolicyContactTitle"), text: t("storePolicyContactText") },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
      <Reveal>
        <span className="flex items-center gap-3 text-[0.6rem] uppercase tracking-wide5 text-brand">
          <span className="fx-rule" />
          Laroche Bijoux
        </span>
        <h1 className="mt-3 font-display text-4xl font-light text-ink md:text-5xl">
          {t("storePolicyTitle")}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">{t("storePolicyIntro")}</p>
      </Reveal>

      <div className="mt-10 space-y-4">
        {sections.map((section, i) => (
          <Reveal key={section.title} delay={i * 0.06}>
            <BentoPanel className="p-6 md:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <section.icon size={17} />
                </span>
                <h2 className="font-display text-xl text-ink">{section.title}</h2>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">{section.text}</p>
            </BentoPanel>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

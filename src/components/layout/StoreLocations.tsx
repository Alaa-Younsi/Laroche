import { MapPin, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Reveal } from "@/components/effects/Reveal";
import { cn } from "@/lib/utils";

const STORES = [
  {
    id: "alger",
    cityKey: "storeCityAlger" as const,
    lat: 36.7790694,
    lng: 3.2404806,
    mapsUrl:
      "https://www.google.com/maps/place/LAROCHE+BIJOUX/@36.7790694,3.2404806,17z/data=!3m1!4b1!4m6!3m5!1s0x128e4f005f81a0ad:0x8d3552c5f7e0a392!8m2!3d36.7790694!4d3.2404806!16s%2Fg%2F11n4bhlysk!18m1!1e1?entry=ttu&g_ep=EgoyMDI2MDcxOS4wIKXMDSoASAFQAw%3D%3D",
  },
  {
    id: "oum-el-bouaghi",
    cityKey: "storeCityOumElBouaghi" as const,
    lat: 35.8730305,
    lng: 7.1102271,
    mapsUrl:
      "https://www.google.com/maps/place/LAROCHE+BIJOUX,+vers+Polyclinique,+Oum+El+Bouaghi+04000/@35.8730305,7.1102271,15z/data=!4m6!3m5!1s0x12f0d7a989d52075:0x66e1ca6db7132cf1!8m2!3d35.8730305!4d7.1102271!16s%2Fg%2F11jh34j1jv?entry=ttu",
  },
] as const;

export function StoreLocations() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <section className="border-t border-line bg-panel">
      <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <Reveal className="mb-8 text-center">
          <span className="mx-auto flex items-center justify-center gap-3 text-[0.6rem] uppercase tracking-wide5 text-brand">
            <span className="fx-rule" />
            {t("storesSubtitle")}
          </span>
          <h2 className="mt-3 font-display text-2xl font-light text-ink md:text-3xl">
            {t("storesTitle")}
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STORES.map((store, i) => (
            <Reveal key={store.id} delay={i * 0.08}>
              <BentoPanel className="overflow-hidden">
                <div className="flex items-center gap-4 p-6">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <MapPin size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block font-display text-lg text-ink">{t(store.cityKey)}</span>
                    <a
                      href={store.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group mt-1 flex w-fit items-center gap-1 text-xs uppercase tracking-wide2 text-muted transition-colors hover:text-brand"
                    >
                      {t("storesCta")}
                      <ArrowUpRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5" />
                    </a>
                  </div>
                </div>
                <iframe
                  title={`${t(store.cityKey)} — Google Maps`}
                  src={`https://www.google.com/maps?q=${store.lat},${store.lng}&z=16&output=embed`}
                  className={cn("h-64 w-full", theme === "dark" && "grayscale invert-[0.92] contrast-[0.9] filter")}
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </BentoPanel>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

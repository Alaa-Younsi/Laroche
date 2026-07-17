import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Star,
  ShieldCheck,
  Truck,
  BadgeCheck,
  ArrowRight,
  Gem,
  Sparkles as SparklesIcon,
  Watch,
  Wand2,
  Crown,
  Users,
  MapPin,
  Award,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategoryGroups } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { useReviews } from "@/hooks/useReviews";
import { useBrands } from "@/hooks/useCollectionsAndBrands";
import { useSeo } from "@/hooks/useSeo";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/product/ProductCard";
import { HeroScene } from "@/components/effects/HeroScene";
import { Marquee } from "@/components/effects/Marquee";
import { SectionDivider } from "@/components/ui/SectionDivider";

const CATEGORY_ICONS = [Gem, SparklesIcon, Watch, Wand2];

const COLLECTION_SHOWCASE = [
  {
    slug: "collection-luxe",
    icon: Crown,
    gradientFrom: "from-[#3a2f0d]",
    key: "sectionCollections" as const,
    titleFr: "Collection Luxe",
    titleAr: "تشكيلة فاخرة",
    textFr: "Des pièces d'exception pour les instants qui comptent.",
    textAr: "قطع استثنائية للحظات المميزة.",
  },
  {
    slug: "collection-mariage",
    icon: SparklesIcon,
    gradientFrom: "from-[#2c2418]",
    key: "sectionCollections" as const,
    titleFr: "Collection Mariage",
    titleAr: "تشكيلة الزفاف",
    textFr: "L'éclat parfait pour le plus beau jour de votre vie.",
    textAr: "البريق المثالي ليومك الأجمل.",
  },
  {
    slug: "collection-soiree",
    icon: Star,
    gradientFrom: "from-[#241d2e]",
    key: "sectionCollections" as const,
    titleFr: "Collection Soirée",
    titleAr: "تشكيلة السهرة",
    textFr: "Brillez de mille feux à chaque occasion spéciale.",
    textAr: "تألقي في كل مناسبة خاصة.",
  },
];

const STATS = [
  { icon: MapPin, valueFr: "58", labelFr: "Wilayas livrées", labelAr: "ولاية موصلة" },
  { icon: Award, valueFr: "925", labelFr: "Argent certifié", labelAr: "فضة معتمدة" },
  { icon: Users, valueFr: "+2 000", labelFr: "Clientes conquises", labelAr: "عميلة راضية" },
  { icon: ShieldCheck, valueFr: "100%", labelFr: "Garantie sur chaque pièce", labelAr: "ضمان على كل قطعة" },
];

const fadeUp = {
  initial: { y: 22 },
  whileInView: { y: 0 },
  viewport: { once: true, margin: "-60px" },
};

export default function Landing() {
  const { t, lang } = useLanguage();
  const { data: groups = [] } = useCategoryGroups();
  const { data: featured = [] } = useProducts({ featured: true });
  const { data: newArrivals = [] } = useProducts({ sort: "newest" });
  const { data: reviews = [] } = useReviews();
  const { data: brands = [] } = useBrands();

  useSeo({
    title: "Laroche Bijoux — Bijouterie & Horlogerie de Luxe en Algérie",
    description:
      "Bijoux en argent 925, acier inoxydable, montres et pièces personnalisées. Livraison dans les 58 wilayas, paiement à la livraison.",
  });

  return (
    <div className="overflow-x-clip">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-bg">
        <div className="pointer-events-none absolute inset-0 bg-radial-glow opacity-60" />
        <div className="pointer-events-none absolute -top-24 -start-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl md:h-96 md:w-96" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-10 pt-10 sm:px-6 md:grid-cols-2 md:gap-8 md:px-8 md:py-24">
          <motion.div
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="order-2 md:order-1"
          >
            <p className="mb-3 text-[0.65rem] uppercase tracking-wide3 text-brand sm:mb-4 sm:text-xs">
              {t("heroSubtitle")}
            </p>
            <h1 className="font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-4 max-w-md text-sm text-muted sm:mt-6 sm:text-base">
              {t("heroSubtitle2")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8 sm:gap-4">
              <Button size="lg" asChild>
                <Link to="/boutique">
                  {t("heroCta")} <ArrowRight size={15} />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/boutique?categorie=montres">{t("navWatches")}</Link>
              </Button>
            </div>
          </motion.div>

          <div className="relative order-1 h-64 sm:h-80 md:order-2 md:h-[26rem]">
            <HeroScene />
          </div>
        </div>

        {/* trust strip */}
        <div className="relative border-t border-line bg-panel/60">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-5 text-[0.65rem] text-muted sm:gap-4 sm:px-6 sm:py-6 sm:text-xs md:grid-cols-4 md:px-8">
            <div className="flex items-center gap-2">
              <BadgeCheck size={16} className="text-brand shrink-0" />
              <span className="truncate">{t("trustAuthentic")}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand shrink-0" />
              <span className="truncate">{t("trustSecure")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-brand shrink-0" />
              <span className="truncate">{t("trustDelivery")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star size={16} className="text-brand shrink-0" />
              <span className="truncate">{t("trustReturn")}</span>
            </div>
          </div>
        </div>
      </section>

      <Marquee
        items={[
          t("navSilver"),
          t("navWatches"),
          t("navPersonalization"),
          t("topbarShipping"),
          t("topbarWarranty"),
        ]}
      />

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 md:px-8 md:py-24">
        <div className="mb-8 flex flex-col gap-2 sm:mb-10">
          <p className="text-xs uppercase tracking-wide3 text-brand">{t("eyebrowCategories")}</p>
          <h2 className="font-display text-3xl text-ink sm:text-4xl">{t("sectionCategories")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {groups.map((group, i) => {
            const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length];
            return (
              <motion.div key={group.id} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.06 }}>
                <Link
                  to={`/boutique?categorie=${group.slug}`}
                  className="fx-card-glow group relative block overflow-hidden rounded-2xl border border-line bg-panel"
                >
                  <div className="relative flex aspect-[4/5] flex-col items-center justify-center gap-4 bg-gradient-to-br from-panel-2 to-panel p-4 text-center sm:aspect-square sm:p-6">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-radial-glow" />
                    {group.image_url ? (
                      <img
                        src={group.image_url}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        className="relative h-14 w-14 rounded-full object-cover sm:h-16 sm:w-16"
                      />
                    ) : (
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-brand/40 text-brand transition-transform duration-500 group-hover:scale-110 sm:h-16 sm:w-16">
                        <Icon size={26} strokeWidth={1.4} />
                      </div>
                    )}
                    <h3 className="relative font-display text-base text-ink group-hover:text-brand sm:text-lg">
                      {lang === "ar" ? group.name_ar : group.name_fr}
                    </h3>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <SectionDivider />

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 md:px-8">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.labelFr}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col items-center text-center"
            >
              <stat.icon size={22} className="mb-3 text-brand" strokeWidth={1.5} />
              <span className="font-display text-3xl text-ink sm:text-4xl">{stat.valueFr}</span>
              <span className="mt-1 text-xs text-muted sm:text-sm">
                {lang === "ar" ? stat.labelAr : stat.labelFr}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="border-t border-line bg-panel/40 py-14 sm:py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <div className="mb-8 flex items-end justify-between sm:mb-10">
              <h2 className="font-display text-3xl text-ink sm:text-4xl">{t("sectionFeatured")}</h2>
              <Link
                to="/boutique"
                className="text-xs uppercase tracking-wide2 text-brand hover:brightness-110"
              >
                {t("viewAll")}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {featured.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Collections showcase — editorial banners, always rendered */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 md:px-8 md:py-24">
        <div className="mb-8 flex flex-col gap-2 sm:mb-10">
          <p className="text-xs uppercase tracking-wide3 text-brand">{t("eyebrowCollections")}</p>
          <h2 className="font-display text-3xl text-ink sm:text-4xl">{t("sectionCollections")}</h2>
        </div>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {COLLECTION_SHOWCASE.map((card, i) => (
            <motion.div key={card.slug} {...fadeUp} transition={{ duration: 0.55, delay: i * 0.1 }}>
              <Link
                to={`/boutique?collection=${card.slug}`}
                className={`group relative block h-72 overflow-hidden rounded-2xl border border-line bg-gradient-to-br ${card.gradientFrom} to-bg p-6 sm:h-80 sm:p-8`}
              >
                <div className="pointer-events-none absolute -end-8 -top-8 h-40 w-40 rounded-full bg-brand/10 blur-2xl transition-transform duration-700 group-hover:scale-125" />
                <card.icon
                  size={28}
                  className="relative text-brand transition-transform duration-500 group-hover:-translate-y-1"
                  strokeWidth={1.3}
                />
                <div className="relative mt-auto flex h-full flex-col justify-end">
                  <h3 className="font-display text-2xl text-white sm:text-3xl">
                    {lang === "ar" ? card.titleAr : card.titleFr}
                  </h3>
                  <p className="mt-2 max-w-[22rem] text-sm text-white/70">
                    {lang === "ar" ? card.textAr : card.textFr}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-wide2 text-brand">
                    {t("seeMore")} <ArrowRight size={13} className="rtl:rotate-180" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      {newArrivals.length > 0 && (
        <section className="border-t border-line bg-panel/40 px-4 py-14 sm:px-6 sm:py-20 md:py-24">
          <div className="mx-auto max-w-7xl md:px-8">
            <div className="mb-8 flex items-end justify-between sm:mb-10">
              <h2 className="font-display text-3xl text-ink sm:text-4xl">{t("sectionNewArrivals")}</h2>
              <Link
                to="/boutique?collection=nouveautes"
                className="text-xs uppercase tracking-wide2 text-brand hover:brightness-110"
              >
                {t("viewAll")}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {newArrivals.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Brands */}
      {brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-20 md:px-8">
          <p className="mb-8 text-xs uppercase tracking-wide3 text-muted sm:mb-10">
            {t("navBrands")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-14">
            {brands.map((brand, i) => (
              <motion.span
                key={brand.id}
                {...fadeUp}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="font-display text-lg text-muted transition-colors hover:text-brand sm:text-xl"
              >
                {brand.name}
              </motion.span>
            ))}
          </div>
        </section>
      )}

      <SectionDivider />

      {/* How it works */}
      <section className="py-14 sm:py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <h2 className="mb-10 text-center font-display text-3xl text-ink sm:mb-12 sm:text-4xl">
            {t("sectionHowItWorks")}
          </h2>
          <div className="grid gap-8 sm:gap-10 md:grid-cols-3">
            {[
              { title: t("howItWorks1Title"), text: t("howItWorks1Text") },
              { title: t("howItWorks2Title"), text: t("howItWorks2Text") },
              { title: t("howItWorks3Title"), text: t("howItWorks3Text") },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="fx-gold-sweep mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-brand font-display text-xl text-brand">
                  {i + 1}
                </div>
                <h3 className="mb-2 font-display text-xl text-ink">{step.title}</h3>
                <p className="text-sm text-muted">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {reviews.length > 0 && (
        <section className="border-t border-line bg-panel/40 px-4 py-14 sm:px-6 sm:py-20 md:py-24">
          <div className="mx-auto max-w-7xl md:px-8">
            <h2 className="mb-10 text-center font-display text-3xl text-ink sm:mb-12 sm:text-4xl">
              {t("sectionTestimonials")}
            </h2>
            <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
              {reviews.slice(0, 6).map((review, i) => (
                <motion.div
                  key={review.id}
                  {...fadeUp}
                  transition={{ duration: 0.45, delay: i * 0.06 }}
                  className="fx-card-glow rounded-2xl border border-line bg-panel p-6"
                >
                  <div className="mb-3 flex gap-0.5">
                    {[...Array(5)].map((_, s) => (
                      <Star
                        key={s}
                        size={14}
                        className={s < review.stars ? "fill-brand text-brand" : "text-line"}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted">&ldquo;{review.review_text}&rdquo;</p>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wide2 text-ink">
                    {review.client_name}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Closing CTA banner */}
      <section className="relative overflow-hidden border-t border-line bg-panel-2/40 px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="pointer-events-none absolute inset-0 bg-radial-glow opacity-70" />
        <div className="relative mx-auto max-w-2xl">
          <p className="fx-shimmer-text font-display text-2xl sm:text-3xl md:text-4xl">
            {t("heroTitle")}
          </p>
          <p className="mt-4 text-sm text-muted sm:text-base">{t("heroSubtitle2")}</p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/boutique">
              {t("heroCta")} <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
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
import { HeroShowcase } from "@/components/effects/HeroShowcase";
import { Marquee } from "@/components/effects/Marquee";
import { CountUp } from "@/components/effects/CountUp";
import { ParallaxImage } from "@/components/effects/ParallaxImage";
import { TiltCard } from "@/components/effects/TiltCard";
import {
  CATEGORY_FALLBACKS,
  COLLECTION_IMAGES,
  EDITORIAL_ACCENT,
  EDITORIAL_MAIN,
  GALLERY,
} from "@/lib/editorialImages";

const CATEGORY_ICONS = [Gem, SparklesIcon, Watch, Wand2];

const COLLECTION_SHOWCASE = [
  {
    slug: "collection-luxe",
    icon: Crown,
    titleFr: "Collection Luxe",
    titleAr: "تشكيلة فاخرة",
    textFr: "Des pièces d'exception pour les instants qui comptent.",
    textAr: "قطع استثنائية للحظات المميزة.",
  },
  {
    slug: "collection-mariage",
    icon: SparklesIcon,
    titleFr: "Collection Mariage",
    titleAr: "تشكيلة الزفاف",
    textFr: "L'éclat parfait pour le plus beau jour de votre vie.",
    textAr: "البريق المثالي ليومك الأجمل.",
  },
  {
    slug: "collection-soiree",
    icon: Star,
    titleFr: "Collection Soirée",
    titleAr: "تشكيلة السهرة",
    textFr: "Brillez de mille feux à chaque occasion spéciale.",
    textAr: "تألقي في كل مناسبة خاصة.",
  },
];

const STATS = [
  { icon: MapPin, value: 58, prefix: "", suffix: "", labelFr: "Wilayas livrées", labelAr: "ولاية موصلة" },
  { icon: Award, value: 925, prefix: "", suffix: "", labelFr: "Argent certifié", labelAr: "فضة معتمدة" },
  { icon: Users, value: 2000, prefix: "+", suffix: "", labelFr: "Clientes conquises", labelAr: "عميلة راضية" },
  { icon: ShieldCheck, value: 100, prefix: "", suffix: "%", labelFr: "Garantie sur chaque pièce", labelAr: "ضمان على كل قطعة" },
];

const EDITORIAL = {
  eyebrowFr: "Maison Laroche",
  eyebrowAr: "دار لاروش",
  titleFr: "L'art de la joaillerie",
  titleAr: "فنّ صياغة المجوهرات",
  textFr:
    "Chaque pièce est choisie pour la pureté de son argent 925, la précision de ses finitions et l'émotion qu'elle porte. De l'écrin à votre porte, dans les 58 wilayas.",
  textAr:
    "كل قطعة مختارة بعناية لنقاء فضتها 925 ودقة تشطيباتها والمشاعر التي تحملها. من العلبة إلى باب منزلك، في 58 ولاية.",
  pointsFr: ["Argent 925 certifié", "Finitions contrôlées à la main", "Écrin offert avec chaque commande"],
  pointsAr: ["فضة 925 معتمدة", "تشطيبات مفحوصة يدويًا", "علبة هدية مع كل طلب"],
};

const GALLERY_HEADING = {
  eyebrowFr: "Inspiration",
  eyebrowAr: "إلهام",
  titleFr: "L'univers Laroche",
  titleAr: "عالم لاروش",
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

/** Editorial curtain reveal — the image is unveiled top-to-bottom on scroll. */
const curtain = {
  initial: { clipPath: "inset(0 0 100% 0)", opacity: 0.4 },
  whileInView: { clipPath: "inset(0 0 0% 0)", opacity: 1 },
  viewport: { once: true, margin: "-60px" },
};

/** Spaced uppercase label with a thin gold rule — the editorial signature. */
function Eyebrow({ children, centered }: { children: ReactNode; centered?: boolean }) {
  return (
    <span
      className={`flex items-center gap-3 text-[0.6rem] uppercase tracking-wide5 text-brand ${
        centered ? "justify-center" : ""
      }`}
    >
      <span className="fx-rule" />
      {children}
    </span>
  );
}

/** Headline that reveals word by word from behind a baseline mask. */
function WordsReveal({ text, className }: { text: string; className?: string }) {
  const reducedMotion = useReducedMotion();
  const words = text.split(" ");

  if (reducedMotion) return <h1 className={className}>{text}</h1>;

  return (
    <h1 className={className}>
      {words.map((word, i) => (
        // the trailing real space is the soft-wrap opportunity — without it
        // the inline-block run is unbreakable and overflows narrow screens
        <span key={i}>
          <span className="inline-block overflow-hidden pb-1 align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: "115%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.75, delay: 0.15 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
            >
              {word}
            </motion.span>
          </span>{" "}
        </span>
      ))}
    </h1>
  );
}

/** Rotating circular "Argent 925" badge stamped over editorial imagery. */
function RotatingBadge() {
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-brand/40 bg-bg/80 backdrop-blur-sm">
      <svg viewBox="0 0 100 100" className="h-20 w-20 animate-spin-slow">
        <defs>
          <path id="badge-circle" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <text className="fill-brand" fontSize="8.5" letterSpacing="3.2">
          <textPath href="#badge-circle">ARGENT 925 • LAROCHE BIJOUX •</textPath>
        </text>
      </svg>
      <span className="absolute font-display text-lg text-brand">✦</span>
    </div>
  );
}

export default function Landing() {
  const { t, lang } = useLanguage();
  // soft gold halo trailing the cursor across the hero (desktop only)
  const glowX = useMotionValue(-9999);
  const glowY = useMotionValue(-9999);
  const glowSpringX = useSpring(glowX, { stiffness: 60, damping: 20, mass: 0.8 });
  const glowSpringY = useSpring(glowY, { stiffness: 60, damping: 20, mass: 0.8 });
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
      {/* ============================== Hero ============================== */}
      <section
        className="relative overflow-hidden border-b border-line bg-bg"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          glowX.set(e.clientX - rect.left - 176);
          glowY.set(e.clientY - rect.top - 176);
        }}
      >
        <div className="fx-hero-veil pointer-events-none absolute inset-0" />
        <motion.div
          style={{ x: glowSpringX, y: glowSpringY }}
          className="pointer-events-none absolute z-0 hidden h-80 w-80 rounded-full bg-brand/[0.07] blur-3xl md:block"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-12 sm:px-6 md:min-h-[calc(100vh-10rem)] md:grid-cols-2 md:gap-10 md:px-8 md:pb-24 md:pt-16">
          <div className="order-2 md:order-1">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7 }}
            >
              <Eyebrow>{t("heroSubtitle")}</Eyebrow>
            </motion.div>

            <WordsReveal
              text={t("heroTitle")}
              className="mt-6 font-display text-5xl font-light leading-[1.05] text-ink sm:text-6xl md:text-7xl"
            />

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="mt-6 max-w-md text-sm leading-relaxed text-muted sm:text-base"
            >
              {t("heroSubtitle2")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="mt-9 flex flex-wrap items-center gap-4"
            >
              <Button size="lg" className="group" asChild>
                <Link to="/boutique">
                  {t("heroCta")}
                  <ArrowRight
                    size={15}
                    className="transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/boutique?categorie=montres">{t("navWatches")}</Link>
              </Button>
            </motion.div>

            {/* inline mini-stats */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.9 }}
              className="mt-10 flex items-center gap-6 border-t border-line pt-6 sm:gap-8 md:mt-12"
            >
              {[
                { value: 58, prefix: "", suffix: "", labelFr: "Wilayas", labelAr: "ولاية" },
                { value: 925, prefix: "", suffix: "", labelFr: "Argent", labelAr: "فضة" },
                { value: 2000, prefix: "+", suffix: "", labelFr: "Clientes", labelAr: "عميلة" },
              ].map((stat) => (
                <div key={stat.labelFr} className="flex flex-col">
                  <span className="font-display text-2xl font-light text-brand sm:text-3xl">
                    <CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </span>
                  <span className="mt-0.5 text-[0.55rem] uppercase tracking-wide3 text-muted">
                    {lang === "ar" ? stat.labelAr : stat.labelFr}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="relative order-1 h-[26rem] sm:h-[30rem] md:order-2 md:h-[36rem]">
            <HeroShowcase />
          </div>
        </div>

        {/* scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="pointer-events-none absolute bottom-20 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
        >
          <span className="text-[0.55rem] uppercase tracking-wide5 text-muted">Scroll</span>
          <span className="relative h-10 w-px overflow-hidden bg-line">
            <motion.span
              animate={{ y: ["-100%", "100%"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-x-0 h-1/2 bg-brand"
            />
          </span>
        </motion.div>

        {/* trust strip */}
        <div className="relative border-t border-line">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-line text-[0.62rem] uppercase tracking-wide2 text-muted md:grid-cols-4 rtl:divide-x-reverse">
            {[
              { icon: BadgeCheck, label: t("trustAuthentic") },
              { icon: ShieldCheck, label: t("trustSecure") },
              { icon: Truck, label: t("trustDelivery") },
              { icon: Star, label: t("trustReturn") },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 px-4 py-5 sm:px-6">
                <Icon size={16} className="shrink-0 text-brand" strokeWidth={1.4} />
                <span className="truncate">{label}</span>
              </div>
            ))}
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

      {/* =========================== Categories =========================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 md:px-8 md:py-28">
        <div className="mb-10 flex flex-col gap-4 sm:mb-14">
          <Eyebrow>{t("eyebrowCategories")}</Eyebrow>
          <h2 className="font-display text-4xl font-light text-ink sm:text-5xl">
            {t("sectionCategories")}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
          {groups.map((group, i) => {
            const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length];
            const photo = group.image_url ?? CATEGORY_FALLBACKS[i % CATEGORY_FALLBACKS.length];
            return (
              <motion.div
                key={group.id}
                {...curtain}
                transition={{ duration: 0.8, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  to={`/boutique?categorie=${group.slug}`}
                  className="group relative block aspect-[3/4] overflow-hidden bg-bg"
                >
                  <img
                    src={photo}
                    alt=""
                    width={700}
                    height={933}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 transition-opacity duration-500 group-hover:from-black/70" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-5 text-center sm:p-6">
                    <Icon size={20} strokeWidth={1.2} className="text-brand" />
                    <h3 className="font-display text-lg font-light text-white sm:text-xl">
                      {lang === "ar" ? group.name_ar : group.name_fr}
                    </h3>
                    <span className="flex items-center gap-2 text-[0.55rem] uppercase tracking-wide4 text-brand opacity-0 transition-all duration-500 group-hover:opacity-100">
                      {t("seeMore")}
                      <span className="h-px w-5 bg-brand" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============================= Stats ============================= */}
      <section className="border-y border-line bg-panel/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-line md:grid-cols-4 rtl:divide-x-reverse">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.labelFr}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col items-center px-4 py-12 text-center sm:py-16"
            >
              <stat.icon size={20} className="mb-4 text-brand" strokeWidth={1.3} />
              <span className="font-display text-4xl font-light text-ink sm:text-5xl">
                <CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </span>
              <span className="mt-2 text-[0.62rem] uppercase tracking-wide2 text-muted sm:text-xs">
                {lang === "ar" ? stat.labelAr : stat.labelFr}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ======================= Featured products ======================= */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 md:px-8 md:py-28">
          <div className="mb-10 flex items-end justify-between sm:mb-14">
            <div className="flex flex-col gap-4">
              <Eyebrow>{t("eyebrowCategories")}</Eyebrow>
              <h2 className="font-display text-4xl font-light text-ink sm:text-5xl">
                {t("sectionFeatured")}
              </h2>
            </div>
            <Link
              to="/boutique"
              className="group hidden shrink-0 items-center gap-2 text-[0.62rem] uppercase tracking-wide4 text-brand transition-opacity hover:opacity-70 sm:flex"
            >
              {t("viewAll")}{" "}
              <ArrowRight
                size={13}
                className="transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {featured.slice(0, 8).map((product, i) => (
              <motion.div key={product.id} {...fadeUp} transition={{ duration: 0.5, delay: (i % 4) * 0.07 }}>
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ======================== Editorial split ======================== */}
      <section className="overflow-hidden border-t border-line bg-panel/40 py-16 sm:py-24 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 md:grid-cols-2 md:gap-16 md:px-8">
          <motion.div {...fadeUp} transition={{ duration: 0.7 }}>
            <Eyebrow>{lang === "ar" ? EDITORIAL.eyebrowAr : EDITORIAL.eyebrowFr}</Eyebrow>
            <h2 className="mt-6 font-display text-4xl font-light leading-tight text-ink sm:text-5xl">
              {lang === "ar" ? EDITORIAL.titleAr : EDITORIAL.titleFr}
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted sm:text-base">
              {lang === "ar" ? EDITORIAL.textAr : EDITORIAL.textFr}
            </p>
            <ul className="mt-8 space-y-4">
              {(lang === "ar" ? EDITORIAL.pointsAr : EDITORIAL.pointsFr).map((point, i) => (
                <motion.li
                  key={point}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                  className="flex items-center gap-3 text-sm text-ink"
                >
                  <span className="text-brand">✦</span>
                  {point}
                </motion.li>
              ))}
            </ul>
            <Button size="lg" variant="outline" className="group mt-10" asChild>
              <Link to="/boutique">
                {t("heroCta")}
                <ArrowRight
                  size={15}
                  className="transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                />
              </Link>
            </Button>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.8 }} className="relative pe-4 md:pe-0">
            <motion.div {...curtain} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
              <ParallaxImage
                src={EDITORIAL_MAIN}
                className="fx-frame aspect-[4/5] border border-line"
                width={1000}
                height={1250}
                drift={50}
              />
            </motion.div>
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -start-4 bottom-10 w-36 border border-brand/50 bg-bg p-1.5 shadow-panel sm:w-44 md:-start-10"
            >
              <img
                src={EDITORIAL_ACCENT}
                alt=""
                width={560}
                height={560}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
            </motion.div>
            <div className="absolute -top-8 end-6">
              <RotatingBadge />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ====================== Collections showcase ====================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 md:px-8 md:py-28">
        <div className="mb-10 flex flex-col gap-4 sm:mb-14">
          <Eyebrow>{t("eyebrowCollections")}</Eyebrow>
          <h2 className="font-display text-4xl font-light text-ink sm:text-5xl">
            {t("sectionCollections")}
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {COLLECTION_SHOWCASE.map((card, i) => (
            <motion.div
              key={card.slug}
              {...curtain}
              transition={{ duration: 0.85, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={`/boutique?collection=${card.slug}`}
                className="group relative flex h-80 flex-col justify-end overflow-hidden border border-line p-8 sm:h-96"
              >
                <img
                  src={COLLECTION_IMAGES[card.slug]}
                  alt=""
                  width={900}
                  height={1200}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                <card.icon
                  size={26}
                  className="absolute start-8 top-8 text-brand transition-transform duration-500 group-hover:-translate-y-1"
                  strokeWidth={1.2}
                />
                <h3 className="relative font-display text-2xl font-light text-white sm:text-3xl">
                  {lang === "ar" ? card.titleAr : card.titleFr}
                </h3>
                <p className="relative mt-3 max-w-[22rem] text-sm leading-relaxed text-white/75">
                  {lang === "ar" ? card.textAr : card.textFr}
                </p>
                <span className="relative mt-6 inline-flex items-center gap-2 text-[0.6rem] uppercase tracking-wide4 text-brand">
                  {t("seeMore")}
                  <span className="h-px w-6 bg-brand transition-all duration-500 group-hover:w-10" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========================== New arrivals ========================== */}
      {newArrivals.length > 0 && (
        <section className="border-t border-line bg-panel/40 px-4 py-16 sm:px-6 sm:py-24 md:py-28">
          <div className="mx-auto max-w-7xl md:px-8">
            <div className="mb-10 flex items-end justify-between sm:mb-14">
              <div className="flex flex-col gap-4">
                <Eyebrow>{t("eyebrowCollections")}</Eyebrow>
                <h2 className="font-display text-4xl font-light text-ink sm:text-5xl">
                  {t("sectionNewArrivals")}
                </h2>
              </div>
              <Link
                to="/boutique?collection=nouveautes"
                className="group hidden shrink-0 items-center gap-2 text-[0.62rem] uppercase tracking-wide4 text-brand transition-opacity hover:opacity-70 sm:flex"
              >
                {t("viewAll")}{" "}
                <ArrowRight
                  size={13}
                  className="transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {newArrivals.slice(0, 4).map((product, i) => (
                <motion.div key={product.id} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.07 }}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================= Gallery mosaic ========================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 md:px-8 md:py-28">
        <div className="mb-10 flex flex-col items-center gap-4 text-center sm:mb-14">
          <Eyebrow centered>
            {lang === "ar" ? GALLERY_HEADING.eyebrowAr : GALLERY_HEADING.eyebrowFr}
          </Eyebrow>
          <h2 className="font-display text-4xl font-light text-ink sm:text-5xl">
            {lang === "ar" ? GALLERY_HEADING.titleAr : GALLERY_HEADING.titleFr}
          </h2>
        </div>
        <div className="grid auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[12rem] sm:gap-4 md:grid-cols-4">
          {GALLERY.map((item, i) => (
            <motion.div
              key={item.src + i}
              {...curtain}
              transition={{ duration: 0.75, delay: (i % 4) * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className={item.tall ? "row-span-2" : ""}
            >
              <Link
                to="/boutique"
                className="group relative block h-full w-full overflow-hidden border border-line"
              >
                <img
                  src={item.src}
                  alt=""
                  width={700}
                  height={item.tall ? 1000 : 500}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-500 group-hover:bg-black/45">
                  <span className="translate-y-2 text-2xl text-brand opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    ✦
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========================= How it works ========================= */}
      <section className="border-t border-line py-16 sm:py-24 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="mb-12 flex flex-col items-center gap-4 text-center sm:mb-16">
            <Eyebrow centered>{t("sectionHowItWorks")}</Eyebrow>
            <h2 className="font-display text-4xl font-light text-ink sm:text-5xl">
              {t("sectionHowItWorks")}
            </h2>
          </div>
          <div className="grid gap-px border border-line bg-line md:grid-cols-3">
            {[
              { title: t("howItWorks1Title"), text: t("howItWorks1Text") },
              { title: t("howItWorks2Title"), text: t("howItWorks2Text") },
              { title: t("howItWorks3Title"), text: t("howItWorks3Text") },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group flex flex-col items-center bg-bg px-8 py-12 text-center transition-colors duration-500 hover:bg-panel"
              >
                <span className="font-display text-5xl font-light text-brand/30 transition-colors duration-500 group-hover:text-brand/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mb-3 mt-5 font-display text-xl text-ink">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ Brands ============================ */}
      {brands.length > 0 && (
        <section className="border-t border-line py-16 text-center sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <p className="mb-10 text-[0.6rem] uppercase tracking-wide5 text-muted">
              {t("navBrands")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5 sm:gap-x-16">
              {brands.map((brand, i) => (
                <motion.span
                  key={brand.id}
                  {...fadeUp}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="font-display text-xl text-muted transition-colors hover:text-brand sm:text-2xl"
                >
                  {brand.name}
                </motion.span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================= Testimonials ========================= */}
      {reviews.length > 0 && (
        <section className="border-t border-line bg-panel/40 px-4 py-16 sm:px-6 sm:py-24 md:py-28">
          <div className="mx-auto max-w-7xl md:px-8">
            <div className="mb-12 flex flex-col items-center gap-4 text-center sm:mb-16">
              <Eyebrow centered>{t("sectionTestimonials")}</Eyebrow>
              <h2 className="font-display text-4xl font-light text-ink sm:text-5xl">
                {t("sectionTestimonials")}
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {reviews.slice(0, 6).map((review, i) => (
                <motion.div
                  key={review.id}
                  {...fadeUp}
                  transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                >
                  <TiltCard className="h-full">
                  <div className="fx-card-glow h-full border border-line bg-bg p-8">
                  <div className="mb-4 flex gap-1">
                    {[...Array(5)].map((_, s) => (
                      <Star
                        key={s}
                        size={13}
                        className={s < review.stars ? "fill-brand text-brand" : "text-line"}
                      />
                    ))}
                  </div>
                  <p className="font-display text-lg font-light leading-relaxed text-ink">
                    &ldquo;{review.review_text}&rdquo;
                  </p>
                  <p className="mt-6 text-[0.6rem] uppercase tracking-wide4 text-brand">
                    {review.client_name}
                  </p>
                  </div>
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ======================= Closing CTA banner ======================= */}
      <section className="relative overflow-hidden border-t border-line px-4 py-20 text-center sm:px-6 sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-radial-glow opacity-50" />
        <motion.div
          animate={{ y: [0, -18, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -start-20 top-10 h-64 w-64 rounded-full bg-brand/10 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 14, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -end-20 bottom-0 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center">
          <Eyebrow centered>{t("navBrands")}</Eyebrow>
          <p className="fx-shimmer-text mt-6 font-display text-3xl font-light sm:text-4xl md:text-5xl">
            {t("heroTitle")}
          </p>
          <p className="mt-5 text-sm leading-relaxed text-muted sm:text-base">
            {t("heroSubtitle2")}
          </p>
          <Button size="lg" className="group mt-10" asChild>
            <Link to="/boutique">
              {t("heroCta")}
              <ArrowRight
                size={15}
                className="transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

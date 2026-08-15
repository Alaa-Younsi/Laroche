// Hero carousel slides. The first slide is the original editorial hero photo
// (links to the whole shop); every following slide is a client-supplied
// category poster from /public/hero-slider and links to that category's
// filtered shop page.
//
// `to` targets are real slugs from the live `categories` / `collections`
// tables — change one here and the slide re-points, nothing else to touch.
//
// The .webp files are generated from the .png sources by
// `python scripts/optimize-hero-slider.py` — re-run it whenever the client
// replaces a poster. The PNGs are the editable source; the site loads the
// WebP (roughly 1/20th the bytes, which is what keeps the phone smooth).

const poster = (file: string) => `/hero-slider/${file}`;

export interface HeroSlide {
  id: string;
  src: string;
  to: string;
  /** Intrinsic pixel size — keeps the frame from reflowing while loading. */
  width: number;
  height: number;
  labelFr: string;
  labelAr: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "boutique",
    // the editorial hero shot, pre-cropped to the 3:4 frame (the original is
    // a 1376x768 landscape PNG — we were shipping 1.1 MB to show this sliver)
    src: poster("00_Boutique.webp"),
    to: "/boutique",
    width: 576,
    height: 768,
    labelFr: "Toute la boutique",
    labelAr: "كل المتجر",
  },
  {
    id: "bagues",
    src: poster("01_Rings-2.webp"),
    to: "/boutique?categorie=bagues-argent",
    width: 484,
    height: 510,
    labelFr: "Bagues",
    labelAr: "خواتم",
  },
  {
    id: "colliers",
    src: poster("02_Necklaces-1.webp"),
    to: "/boutique?categorie=colliers-argent",
    width: 365,
    height: 510,
    labelFr: "Colliers",
    labelAr: "قلادات",
  },
  {
    id: "bracelets",
    src: poster("03_Bracelets-2.webp"),
    to: "/boutique?categorie=bracelets-argent",
    width: 356,
    height: 510,
    labelFr: "Bracelets",
    labelAr: "أساور",
  },
  {
    id: "boucles",
    src: poster("04_Earrings.webp"),
    to: "/boutique?categorie=boucles-argent",
    width: 331,
    height: 510,
    labelFr: "Boucles d'oreilles",
    labelAr: "أقراط",
  },
  {
    id: "montres",
    src: poster("05_Watches.webp"),
    to: "/boutique?categorie=montres",
    width: 359,
    height: 514,
    labelFr: "Montres",
    labelAr: "ساعات",
  },
  {
    id: "parures",
    src: poster("06_Sets.webp"),
    to: "/boutique?categorie=parures-argent",
    width: 410,
    height: 514,
    labelFr: "Parures",
    labelAr: "أطقم",
  },
  {
    id: "accessoires",
    src: poster("07_Accessories.webp"),
    to: "/boutique?collection=bijoux-homme",
    width: 379,
    height: 514,
    labelFr: "Accessoires",
    labelAr: "إكسسوارات",
  },
  {
    id: "cadeaux",
    src: poster("08_Gifts.webp"),
    to: "/boutique?collection=cadeaux",
    width: 388,
    height: 514,
    labelFr: "Cadeaux",
    labelAr: "هدايا",
  },
];

/** Milliseconds a slide stays on screen before the carousel advances. */
export const HERO_SLIDE_DURATION = 2000;

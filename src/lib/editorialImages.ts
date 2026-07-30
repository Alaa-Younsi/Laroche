// Client-supplied Laroche Bijoux photography, served from /public/images.

const img = (file: string) => `/images/${file}`;

/** Hero main plane: model wearing layered gold necklaces, moody light. */
export const HERO_MAIN = img("1785266218128.png");
/** Hero foreground accent: rose-gold diamond eternity ring on black fabric. */
export const HERO_ACCENT = img("1785265199650.png");
/** Hero background accent: rose-gold chronograph in its box. */
export const HERO_SECONDARY = img("1785265174766.png");

/** Category card fallbacks when the DB category has no image, in nav order. */
export const CATEGORY_FALLBACKS = [
  img("1785266215695.png"), // Argent 925
  img("1785266230876.png"), // Acier Inoxydable
  img("1785266211879.png"), // Montres
  img("1785266078964.png"), // Personnalisation
  img("1785266068701.png"), // Plaqué Or
];

/** Collection showcase banners. */
export const COLLECTION_IMAGES: Record<string, string> = {
  "collection-luxe": img("1785266207230.png"), // Parures Luxe — diamond necklace/earrings/ring
  "collection-mariage": img("1785266205016.png"), // Alliances — gold & pavé wedding bands
  "collection-soiree": img("1785266150300.png"), // Bagues — statement sapphire cocktail ring
};

/** Editorial split section — jeweler's hands setting a personalized charm. */
export const EDITORIAL_MAIN = img("1785265178922.png");
/** Editorial floating accent — same ring macro as the hero foreground. */
export const EDITORIAL_ACCENT = img("1785265199650.png");

/** Gallery mosaic strip ("l'univers Laroche"). */
export const GALLERY = [
  { src: img("1785265188230.png"), tall: true }, // pearl double-strand necklace on bust
  { src: img("1785265197468.png"), tall: false }, // sapphire & diamond necklace on stone
  { src: img("1785265185426.png"), tall: true }, // silver bangles & layered necklaces
  { src: img("1785265203663.png"), tall: false }, // gold wedding rings on Mariage box
  { src: img("1785265179925.png"), tall: true }, // gold chain bracelet on editorial flatlay
  { src: img("1785265237639.png"), tall: false }, // silver wedding rings on Mariage box
];

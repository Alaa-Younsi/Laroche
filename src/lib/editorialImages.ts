// Curated editorial jewelry photography (Unsplash CDN, hotlink-safe).
// Placeholder art direction until the client supplies brand shoots —
// every URL verified to resolve. Swap freely; keep the same aspect intent.

const u = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

/** Hero main plane: layered gold necklaces, moody. */
export const HERO_MAIN = u("photo-1599643478518-a784e5dc4c8f", 900);
/** Hero foreground accent: halo diamond ring on black. */
export const HERO_ACCENT = u("photo-1605100804763-247f67b3557e", 500);
/** Hero background accent: rose-gold chronograph on teal. */
export const HERO_SECONDARY = u("photo-1522312346375-d1a52e2b99b3", 500);

/** Category card fallbacks when the DB category has no image, in nav order. */
export const CATEGORY_FALLBACKS = [
  u("photo-1515562141207-7a88fb7ce338", 700), // pearl necklace in gift box — argent
  u("photo-1610694955371-d4a3e0ce4b52", 700), // dainty layered necklaces — acier
  u("photo-1587836374828-4dbafa94cf0e", 700), // black steel watch — montres
  u("photo-1611591437281-460bfbe1220a", 700), // gold pavé bangle — personnalisation
  u("photo-1602173574767-37ac01994b2a", 700), // gold chain bracelet — plaqué/xuping
];

/** Collection showcase banners. */
export const COLLECTION_IMAGES: Record<string, string> = {
  "collection-luxe": u("photo-1573408301185-9146fe634ad0", 900), // diamond bracelet on black
  "collection-mariage": u("photo-1601121141461-9d6647bca1ed", 900), // gold necklace set
  "collection-soiree": u("photo-1535632066927-ab7c9ab60908", 900), // sapphire statement earrings
};

/** Editorial split section — model in gold slip dress with layered necklaces. */
export const EDITORIAL_MAIN = u("photo-1599459183200-59c7687a0275", 1000);
/** Editorial floating accent — halo diamond ring macro. */
export const EDITORIAL_ACCENT = u("photo-1605100804763-247f67b3557e", 560);

/** Gallery mosaic strip ("l'univers Laroche"). */
export const GALLERY = [
  { src: u("photo-1617038220319-276d3cfab638", 700), tall: true }, // gold hoops on stone
  { src: u("photo-1524592094714-0f0654e20314", 700), tall: false }, // minimalist watch in hand
  { src: u("photo-1603561591411-07134e71a2a9", 700), tall: false }, // pink sapphire ring
  { src: u("photo-1522312346375-d1a52e2b99b3", 700), tall: true }, // rose-gold chronograph
  { src: u("photo-1602173574767-37ac01994b2a", 700), tall: false }, // gold chain bracelet
  { src: u("photo-1599459183200-59c7687a0275", 700), tall: false }, // gold slip dress model
];

export function formatPrice(value: number): string {
  const rounded = Math.round(value);
  const withSeparators = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSeparators} DA`;
}

export function formatDate(iso: string, lang: "fr" | "ar" = "fr"): string {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-DZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

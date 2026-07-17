export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uniqueSlug(
  base: string,
  checkExists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "produit";
  let candidate = root;
  let n = 2;
  while (await checkExists(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

export function variantPickKey(
  color: string | null,
  size: string | null,
  variants: { name_fr: string; value: string }[],
): string {
  const variantKey = variants
    .map((v) => `${v.name_fr}:${v.value}`)
    .sort()
    .join("|");
  return [color ?? "", size ?? "", variantKey].join("::");
}

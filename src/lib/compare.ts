export const COMPARE_MAX = 4;
export const COMPARE_STORAGE_KEY = "btoprojects.compare.v1";

/** Canonical comparison URL — shareable, per DESIGN.md "URL is state". */
export function compareUrl(slugs: string[]): string {
  return slugs.length ? `/compare?p=${slugs.map(encodeURIComponent).join(",")}` : "/compare";
}

/** "bayshore-vista" → "Bayshore Vista" (display fallback only). */
export function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

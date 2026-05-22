/**
 * Converts an arbitrary string into a URL-safe slug
 * (lowercase, accent-free, hyphen-separated).
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

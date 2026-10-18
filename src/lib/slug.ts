/**
 * Slugify a lowercase, hyphenated English string (AGENTS: slugs are lowercase,
 * hyphenated English, unique per table). Strips accents and anything outside
 * `a-z0-9`, collapses separators, and trims leading/trailing hyphens.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** True when `value` is a valid slug (may be empty for "not set yet"). */
export function isValidSlug(value: string): boolean {
  return value === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * A category node for the header mega-menu. Structurally identical to
 * `NavCategory` in `@/server/catalog`, re-declared here so client leaves
 * never import the server-only module.
 */
export type HeaderCategory = {
  slug: string;
  name_en: string;
  name_bn: string | null;
  children: HeaderCategory[];
};

/**
 * A collection link for the Industries menu. Re-declared here so client
 * leaves never import the server-only catalog module.
 */
export type HeaderCollection = {
  slug: string;
  name_en: string;
  name_bn: string | null;
};

/**
 * Plan 15.2 B6 — the ONLY shape a quote `attachment_path` may take.
 *
 * Customer artwork now lives in the private `quote-attachments` bucket. The
 * object path is generated SERVER-side (see the `requestArtworkUpload` action)
 * as `<yyyy>/<uuid>.<ext>` and handed back to the browser, which uploads
 * straight to a signed URL. The browser then posts that path in a hidden field
 * — so it is attacker-editable, and staff later open it via a signed URL. We
 * therefore accept nothing but a path we could plausibly have minted: a
 * four-digit year folder, a canonical lowercase UUID basename, and one of the
 * allowed extensions. Anything else (traversal `../`, absolute URLs, foreign
 * hosts, uppercase, a second dot, a missing extension) is rejected before it
 * ever reaches the DB or a signed-URL call.
 */
const ATTACHMENT_PATH_RE =
  /^\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|pdf)$/;

/** Extensions the bucket + this validator agree on (mirrors allowed_mime_types). */
export const QUOTE_ATTACHMENT_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "pdf",
] as const;

export const QUOTE_ATTACHMENT_BUCKET = "quote-attachments";

export function isQuoteAttachmentPath(value: string): boolean {
  return ATTACHMENT_PATH_RE.test(value);
}

/**
 * Map a client-declared mime type to a safe extension, or null when the type
 * is not allowed. The server uses this to choose the extension it bakes into
 * the generated path — the client never dictates the extension directly.
 */
export function extensionForMime(mime: string): string | null {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return null;
  }
}

/**
 * A quote's `attachment_path` arrives from a hidden form field, so it is
 * attacker-controlled. Staff later see it as an <img src> and a link, so only a
 * Cloudinary delivery URL inside our artwork folder is accepted.
 *
 * The folder name must match ROOT_FOLDER + "artwork" in `src/lib/cloudinary.ts`.
 * Pinning the cloud name (from CLOUDINARY_URL) is a server-side follow-up.
 */
const ARTWORK_FOLDER_PATH = "/Primebagfactory/artwork/";

export function isOwnArtworkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname.includes(ARTWORK_FOLDER_PATH)
    );
  } catch {
    return false;
  }
}

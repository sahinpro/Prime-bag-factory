import { cn } from "cn";
import Image from "next/image";

/**
 * Catalog media. Public images are absolute Cloudinary delivery URLs (whitelisted
 * in `next.config.ts`). `src` may be null when a row has no image yet, so we fall
 * back to a neutral surface block instead of a broken `<img>` — every product
 * card keeps the same aspect and never shows a broken icon.
 */
export function Media({
  src,
  alt,
  className,
  imgClassName,
  priority = false,
  sizes,
  loading,
}: {
  src: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
  loading?: "eager" | "lazy";
}) {
  if (!src) {
    return (
      <div
        role="presentation"
        aria-hidden
        className={cn("bg-white", className)}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-surface-1", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        priority={priority}
        loading={priority ? undefined : loading}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}

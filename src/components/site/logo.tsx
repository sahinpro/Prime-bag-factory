import Image from "next/image";
import Link from "next/link";

const HORIZONTAL = {
  width: 1470,
  height: 512,
} as const;

type LogoVariant = "light" | "dark" | "mark";

type LogoProps = {
  variant: LogoVariant;
  className?: string;
  alt?: string;
  priority?: boolean;
};

const sources: Record<LogoVariant, string> = {
  light: "/brand/Logo black.png",
  dark: "/brand/Logo white.png",
  mark: "/brand/logo-mark.svg",
};

export function Logo({
  variant,
  className,
  alt = "Prime Bag Factory",
  priority = false,
}: LogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src={sources.mark}
        alt={alt}
        width={32}
        height={32}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <Image
      src={sources[variant]}
      alt={alt}
      width={HORIZONTAL.width}
      height={HORIZONTAL.height}
      sizes="140px"
      priority={priority}
      className={className}
    />
  );
}

/**
 * Theme-aware horizontal logo. CSS switches variants so there is no flash.
 *
 * The light variant is `priority`: the PR #2 CI Lighthouse diagnostics showed
 * this lazy image is the LCP on `/en/quote` (painted at 3.8 s against a 1.2 s
 * FCP). With `sizes="140px"` the preloaded payload is a single small raster,
 * so it cannot swamp the real LCP the way the old un-sized 1470px srcSet did
 * (see Decision Log 2026-10-18, superseded by the 2026-10-19 CI data entry).
 * The dark variant stays lazy: `display:none` in light mode means it is never
 * fetched for the light-theme audit, and in dark mode a top-of-viewport lazy
 * image is fetched immediately by the browser anyway.
 */
export function ThemeLogo({
  className,
  imageClassName = "h-auto max-w-40",
}: {
  className?: string;
  /** Header passes a 24px-tall lockup. Other pages keep the default. */
  imageClassName?: string;
}) {
  return (
    <Link href="/" aria-label="Prime Bag Factory" className="shrink-0">
      <span className={className}>
        <Logo
          variant="light"
          alt=""
          priority
          className={`dark:hidden ${imageClassName}`}
        />
        <Logo
          variant="dark"
          alt=""
          className={`hidden dark:block ${imageClassName}`}
        />
      </span>
    </Link>
  );
}

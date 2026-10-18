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
 * Not `priority`: the logo is a small decorative (`alt=""`) header asset and is
 * never the intended LCP on the public marketing pages (home = hero copy,
 * product = `<h1>` title), both server-rendered text. Eagerly preloading two
 * large raster variants (light + dark) just competed with the real LCP and the
 * critical JS in Lighthouse's throttled window. As a top-of-viewport image the
 * browser still fetches it on the first frame via lazy-loading's immediate
 * intersection. See plan Phase 3 T8 / Decision Log 2026-10-18.
 */
export function ThemeLogo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Prime Bag Factory">
      <span className={className}>
        <Logo
          variant="light"
          alt=""
          className="h-auto max-w-40 dark:hidden"
        />
        <Logo
          variant="dark"
          alt=""
          className="hidden h-auto max-w-40 dark:block"
        />
      </span>
    </Link>
  );
}

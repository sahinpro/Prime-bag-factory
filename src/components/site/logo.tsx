import Image from "next/image";

const HORIZONTAL = {
  width: 240,
  height: 53,
} as const;

type LogoVariant = "light" | "dark" | "mark";

type LogoProps = {
  variant: LogoVariant;
  className?: string;
  alt?: string;
  priority?: boolean;
};

const sources: Record<LogoVariant, string> = {
  light: "/brand/logo-horizontal-on-light.svg",
  dark: "/brand/logo-horizontal-on-dark.svg",
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
      priority={priority}
      className={className}
    />
  );
}

/** Theme-aware horizontal logo. CSS switches variants so there is no flash. */
export function ThemeLogo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Logo
        variant="light"
        priority
        className="h-auto w-[min(100%,240px)] min-w-[120px] dark:hidden"
      />
      <Logo
        variant="dark"
        alt=""
        priority
        className="hidden h-auto w-[min(100%,240px)] min-w-[120px] dark:block"
      />
    </span>
  );
}

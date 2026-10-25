/**
 * Original line illustrations for the hero when the catalog has no photo yet.
 * Not a stand-in for another brand's product shot.
 */
export function BagArt({ variant }: { variant: "delivery" | "backpack" }) {
  if (variant === "backpack") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 320 240"
        className="h-full w-full text-foreground"
        fill="none"
      >
        <path
          d="M118 78c8-28 76-28 84 0"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect
          x="78"
          y="72"
          width="164"
          height="132"
          rx="28"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M108 118h104M108 150h104"
          className="stroke-brand"
          strokeWidth="1.75"
          strokeDasharray="5 7"
          strokeLinecap="round"
        />
        <path
          d="M96 96c-28 10-36 48-28 78M224 96c28 10 36 48 28 78"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect
          x="124"
          y="156"
          width="72"
          height="28"
          rx="8"
          stroke="currentColor"
          strokeWidth="2.5"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 500"
      className="h-full w-full text-foreground"
      fill="none"
    >
      <path
        d="M150 118c0-28 100-28 100 0"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M132 118h136l18 36H114l18-36Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="96"
        y="154"
        width="208"
        height="280"
        rx="36"
        stroke="currentColor"
        strokeWidth="3"
      />
      <rect
        x="128"
        y="214"
        width="144"
        height="92"
        rx="16"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M124 196h152M124 390h152"
        className="stroke-brand"
        strokeWidth="2"
        strokeDasharray="6 8"
        strokeLinecap="round"
      />
    </svg>
  );
}

import Link from "next/link";

// Root 404 fallback (plan §15 D3 / R8). In practice next-intl's proxy prefixes
// every page route with a locale, so real page 404s are handled by
// [locale]/not-found.tsx. This is the last-resort boundary for paths that never
// enter a localized group. It sits above both parallel root layouts, so it
// cannot use design tokens, theme or i18n — keep it plain, English, and stack
// free.
export default function RootNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "24px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "20px", fontWeight: 600 }}>Page not found</h1>
      <p style={{ fontSize: "16px", maxWidth: "32rem" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" style={{ fontSize: "16px" }}>
        Go to homepage
      </Link>
    </main>
  );
}

"use client";

// Root boundary (plan §15 D3 / R8). global-error.tsx replaces the entire
// document — including both parallel root layouts — so it must render its own
// <html>/<body> and cannot depend on design tokens, theme or i18n providers.
// Keep it plain and never leak the stack. This only fires for a crash in a root
// layout; every page/route error is caught by the [locale] or (admin) error.tsx.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
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
          <h1 style={{ fontSize: "20px", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "16px", maxWidth: "32rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              fontSize: "16px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid currentColor",
              cursor: "pointer",
              background: "transparent",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

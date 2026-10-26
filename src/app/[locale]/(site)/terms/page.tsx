import { redirectToLegal } from "@/lib/redirect-to-legal";
// Public locale pages sit under the [locale] segment, which next-intl reads above
// every page (root layout + provider). Navigations into this route may block on
// that URL data; the route is fully prerendered via generateStaticParams. See
// src/app/[locale]/layout.tsx for the full rationale.
export const instant = false;

export default function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return redirectToLegal(params);
}

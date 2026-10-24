import { redirectToLegal } from "@/lib/redirect-to-legal";

export default function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return redirectToLegal(params);
}

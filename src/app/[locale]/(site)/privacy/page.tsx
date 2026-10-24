import { redirectToLegal } from "@/lib/redirect-to-legal";

export default function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return redirectToLegal(params);
}

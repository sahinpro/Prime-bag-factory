import { redirectToLegal } from "@/lib/redirect-to-legal";

export default function CustomOrderPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return redirectToLegal(params);
}

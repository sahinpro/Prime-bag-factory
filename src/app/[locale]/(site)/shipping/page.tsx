import { redirectToLegal } from "@/lib/redirect-to-legal";

export default function ShippingPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return redirectToLegal(params);
}

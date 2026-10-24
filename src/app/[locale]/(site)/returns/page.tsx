import { redirectToLegal } from "@/lib/redirect-to-legal";

export default function ReturnsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return redirectToLegal(params);
}

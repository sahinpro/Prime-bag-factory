import { cronAuthorized, deliverPendingEmails } from "@/server/notifications";

/**
 * Plan 15.2 C1 — scheduled outbox sender. Vercel Cron calls GET on the
 * schedule in `vercel.json` and, when `CRON_SECRET` is set, sends
 * `Authorization: Bearer <secret>`. Missing or wrong secret is a 401.
 * The route never sends mail itself; it only runs the outbox worker.
 */
export async function GET(request: Request) {
  if (
    !cronAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await deliverPendingEmails();
  return Response.json(result);
}

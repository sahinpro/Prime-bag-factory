import { cronAuthorized, deliverPendingEmails } from "@/server/notifications";

/**
 * Plan 15.2 C1 — scheduled outbox sender. A pg_cron job (every 5 minutes,
 * scheduled in migration `202610210002_c2_notification_cron`) fires this GET
 * through pg_net with `Authorization: Bearer <CRON_SECRET>`; the secret lives
 * in `settings.notification_cron` and must match this deployment's
 * `CRON_SECRET`. (Vercel Cron was dropped — the Hobby plan forbids a schedule
 * that runs more than once a day.) Missing or wrong secret is a 401.
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

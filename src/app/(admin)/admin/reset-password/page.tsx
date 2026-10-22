import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: { absolute: "Choose a new password · Prime Bag Factory Admin" },
};

export const instant = false;

/**
 * Choose-a-new-password step of the admin reset flow (owner track,
 * 2026-10-22). Requires the session minted by `/admin/auth/confirm` — the
 * recovery link is the ONLY way here (nothing links to this page), and
 * without a session it bounces back to the forgot-password form with the
 * generic invalid-link note. Outside `(protected)` because a recovery
 * session must not be bounced to the normal login first. English-first like
 * the rest of admin. `no-store` comes from the `/admin/:path*` headers rule.
 */
export default async function ResetPasswordPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/forgot-password?reason=invalid");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <Link href="/" aria-label="Prime Bag Factory" className="shrink-0">
        <Logo variant="mark" className="size-12" />
      </Link>
      <section className="w-full max-w-md space-y-8 rounded-card border border-border bg-card p-6 shadow-sm sm:p-8">
        <header className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Prime Bag Factory
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose a new password
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a new password for your admin account. All other signed-in
            devices will be signed out.
          </p>
        </header>
        <ResetPasswordForm />
        <p className="text-sm text-muted-foreground">
          <Link
            href="/admin/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

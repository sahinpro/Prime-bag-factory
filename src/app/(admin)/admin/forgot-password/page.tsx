import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: { absolute: "Reset your password · Prime Bag Factory Admin" },
};

export const instant = false;

/**
 * Admin forgot-password (owner track, 2026-10-22). Outside `(protected)` and
 * allowlisted in `proxy.ts`, so it renders without a session. English-first
 * like the rest of the admin panel (outside `[locale]`, no next-intl).
 * `?reason=invalid` is the only thing the confirm handler can send back here,
 * and it stays generic — no account or link detail leaks.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

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
            Reset your password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your staff email and we&apos;ll send a link to choose a new
            password.
          </p>
        </header>
        {reason === "invalid" ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          >
            That reset link is invalid or has expired. Request a new one.
          </p>
        ) : null}
        <ForgotPasswordForm />
        <p className="text-sm text-muted-foreground">
          <Link
            href="/admin/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Back to sign in
          </Link>
        </p>
      </section>
      <p className="text-sm text-muted-foreground">
        <Link
          href="/"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Back to the store
        </Link>
      </p>
    </main>
  );
}

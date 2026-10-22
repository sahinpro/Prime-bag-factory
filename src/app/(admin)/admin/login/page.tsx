import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { getSafeAdminRedirectPath } from "@/lib/auth-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: { absolute: "Staff sign in · Prime Bag Factory Admin" },
};

export const instant = false;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;

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
            Staff sign in
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your authorized staff account.
          </p>
        </header>
        {reset === "1" ? (
          <p
            role="status"
            className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success"
          >
            Password updated. Sign in with your new password.
          </p>
        ) : null}
        <LoginForm nextPath={getSafeAdminRedirectPath(next)} />
        <p className="text-sm text-muted-foreground">
          <Link
            href="/admin/forgot-password"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Forgot password?
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

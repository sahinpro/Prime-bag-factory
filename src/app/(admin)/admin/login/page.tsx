import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import { getSafeAdminRedirectPath } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Staff sign in | Prime Bag Factory",
};

export const instant = false;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
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
        <LoginForm nextPath={getSafeAdminRedirectPath(next)} />
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/auth";
import { getSafeAdminRedirectPath } from "@/lib/auth-redirect";
import { listTotpFactors } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";
import { cancelMfaChallenge } from "./actions";
import { MfaVerifyForm } from "./mfa-verify-form";

export const metadata = {
  title: { absolute: "Two-factor verification · Prime Bag Factory Admin" },
};

export const instant = false;

/**
 * The AAL2 step (plan §15 D2). Reached from sign-in for a staff member with an
 * enrolled factor, or from the protected layout when enforcement is on and the
 * session is still at AAL1. It issues a fresh TOTP challenge and asks for the
 * code; verifying elevates the session and drops back into the panel.
 */
export default async function MfaChallengePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string }>;
}>) {
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const next = getSafeAdminRedirectPath((await searchParams).next);
  const factors = await listTotpFactors();
  const factor = factors[0];

  if (!factor) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          No authenticator is enrolled on this account yet. Sign in from a device
          that has completed enrolment, or ask an owner to reset your access.
        </p>
        <form action={cancelMfaChallenge}>
          <Button type="submit" variant="outline" className="w-full">
            Back to sign in
          </Button>
        </form>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data: challenge } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });

  if (!challenge?.id) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          We could not start a verification request. Please try again.
        </p>
        <form action={cancelMfaChallenge}>
          <Button type="submit" variant="outline" className="w-full">
            Back to sign in
          </Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell
      heading="Two-factor verification"
      hint={`Open your authenticator app${
        factor.friendlyName ? ` (${factor.friendlyName})` : ""
      } and enter the 6-digit code.`}
    >
      <MfaVerifyForm
        factorId={factor.id}
        challengeId={challenge.id}
        nextPath={next}
      />
      <form action={cancelMfaChallenge}>
        <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
          Use a different account
        </Button>
      </form>
    </Shell>
  );
}

function Shell({
  children,
  heading = "Staff sign in",
  hint,
}: Readonly<{
  children: React.ReactNode;
  heading?: string;
  hint?: string;
}>) {
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
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          {hint ? (
            <p className="text-sm text-muted-foreground">{hint}</p>
          ) : null}
        </header>
        {children}
      </section>
    </main>
  );
}

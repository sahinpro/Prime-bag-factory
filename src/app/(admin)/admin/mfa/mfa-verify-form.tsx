"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  verifyMfaCode,
  type MfaVerifyState,
} from "./actions";

const initialState: MfaVerifyState = { error: null };

/** Two-factor prompt: enter the 6-digit code from the enrolled authenticator. */
export function MfaVerifyForm({
  factorId,
  challengeId,
  nextPath,
}: Readonly<{
  factorId: string;
  challengeId: string;
  nextPath: string;
}>) {
  const [state, formAction, pending] = useActionState(
    verifyMfaCode,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="next" value={nextPath} />
      {state.error ? (
        <p
          id="mfa-error"
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="code" className="text-sm font-medium">
          Authentication code
        </label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          aria-describedby={state.error ? "mfa-error" : undefined}
          className="text-center tracking-[0.5em]"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}

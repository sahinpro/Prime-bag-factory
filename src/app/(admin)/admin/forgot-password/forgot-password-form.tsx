"use client";

import { useActionState, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema } from "@/lib/validators/password-reset";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { sent: false, error: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  function validateClientSide(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const result = forgotPasswordSchema.safeParse({
      email: String(formData.get("email") ?? "").trim(),
    });

    if (!result.success) {
      event.preventDefault();
      setValidationError("Enter a valid email address.");
      return;
    }

    setValidationError(null);
  }

  if (state.sent) {
    // Generic confirmation — identical whether or not the address has an
    // account, so this page cannot be used to enumerate staff emails.
    return (
      <div
        role="status"
        className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success"
      >
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-muted-foreground">
          If that email belongs to an admin account, a password reset link is on
          its way. The link expires shortly and must be opened in this browser.
        </p>
      </div>
    );
  }

  const error = validationError ?? state.error;

  return (
    <form
      action={formAction}
      onSubmit={validateClientSide}
      className="space-y-5"
    >
      {error ? (
        <p
          id="forgot-password-error"
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          aria-describedby={error ? "forgot-password-error" : undefined}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

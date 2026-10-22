"use client";

import { useActionState, useState, type FormEvent } from "react";

import { completePasswordReset, type ResetPasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema } from "@/lib/validators/password-reset";

const initialState: ResetPasswordState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    completePasswordReset,
    initialState,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  function validateClientSide(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const result = resetPasswordSchema.safeParse({
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });

    if (!result.success) {
      event.preventDefault();
      setValidationError(
        result.error.issues[0]?.message ??
          "Enter your new password twice (at least 12 characters).",
      );
      return;
    }

    setValidationError(null);
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
          id="reset-password-error"
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-describedby={
            error
              ? "reset-password-error"
              : "reset-password-hint"
          }
        />
        <p id="reset-password-hint" className="text-xs text-muted-foreground">
          At least 12 characters.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirm new password
        </label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={error ? "reset-password-error" : undefined}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

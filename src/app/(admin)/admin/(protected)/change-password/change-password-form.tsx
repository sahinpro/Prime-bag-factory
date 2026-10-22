"use client";

import { useActionState, useState, type FormEvent } from "react";

import { changePassword, type ChangePasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordSchema } from "@/lib/validators/password-reset";

const initialState: ChangePasswordState = { error: null, success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  function validateClientSide(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const result = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });

    if (!result.success) {
      event.preventDefault();
      setValidationError(
        result.error.issues[0]?.message ??
          "Fill in every field (new password at least 12 characters).",
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
          id="change-password-error"
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {state.success ? (
        <p
          id="change-password-success"
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success"
        >
          Password updated.
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          Current password
        </label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={error ? "change-password-error" : undefined}
        />
      </div>

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
            error ? "change-password-error" : "change-password-hint"
          }
        />
        <p id="change-password-hint" className="text-xs text-muted-foreground">
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
          aria-describedby={error ? "change-password-error" : undefined}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

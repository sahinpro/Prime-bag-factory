"use client";

import { useActionState, useState, type FormEvent } from "react";

import { signIn, type StaffLoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffLoginSchema } from "@/lib/validators/staff-login";

const initialState: StaffLoginState = { error: null };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [validationError, setValidationError] = useState<string | null>(null);

  function validateClientSide(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const result = staffLoginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      next: formData.get("next") ?? undefined,
    });

    if (!result.success) {
      event.preventDefault();
      setValidationError("Enter a valid email address and password.");
      return;
    }

    setValidationError(null);
  }

  const error = validationError ?? state.error;

  return (
    <form action={formAction} onSubmit={validateClientSide} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      {error ? (
        <p
          id="login-error"
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
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

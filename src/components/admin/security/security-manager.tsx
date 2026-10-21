"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Smartphone, Trash2 } from "lucide-react";

import {
  enrollFactor,
  unenrollFactor,
  verifyFactor,
  setRequireMfa,
  type EnrollResult,
} from "@/app/(admin)/admin/security/actions";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import {
  FlashLine,
  useActionSave,
} from "@/components/admin/products/use-action-save";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MfaFactorRow } from "@/lib/mfa";

type Enrollment = Extract<EnrollResult, { ok: true }>;

/**
 * Two-factor self-service for owner/manager (plan §15 D2). Enrol an authenticator
 * app (QR + manual secret, then confirm one code), list and remove factors, and —
 * behind a confirm carrying an explicit lock-out warning — flip
 * `settings.security.require_mfa`, which turns AAL2 enforcement on for the whole
 * panel. The shared secret and the QR (a data URI, not a remote asset) are
 * transient and never logged.
 */
export function SecurityManager({
  factors,
  requireMfa,
}: Readonly<{
  factors: MfaFactorRow[];
  requireMfa: boolean;
}>) {
  const router = useRouter();
  const { saving, flash, run } = useActionSave();
  const [deviceName, setDeviceName] = React.useState("");
  const [enrollment, setEnrollment] = React.useState<Enrollment | null>(null);
  const [code, setCode] = React.useState("");
  // `useActionSave.run` only tracks a flash on success/error of the action; a
  // failed enrol (which returns an error but should not refresh) uses a local
  // message merged into the same status line.
  const [localError, setLocalError] = React.useState<string | null>(null);

  const hasVerified = factors.some((f) => f.verified);

  async function handleEnroll() {
    setEnrollment(null);
    const res = await enrollFactor(
      deviceName.trim() ? { friendlyName: deviceName.trim() } : {},
    );
    if (res.ok) {
      setEnrollment(res);
      setCode("");
    } else {
      setLocalError(res.error);
    }
  }

  async function handleVerify() {
    if (!enrollment) return;
    const ok = await run(
      () => verifyFactor(enrollment.factorId, code),
      "Authenticator enrolled.",
    );
    if (ok) {
      setEnrollment(null);
      setDeviceName("");
      setCode("");
      router.refresh();
    }
  }

  async function handleUnenroll(factorId: string): Promise<void> {
    const ok = await run(() => unenrollFactor(factorId), "Authenticator removed.");
    if (ok) router.refresh();
  }

  async function handleToggle(next: boolean): Promise<void> {
    const ok = await run(
      () => setRequireMfa(next),
      next ? "MFA enforcement turned on." : "MFA enforcement turned off.",
    );
    if (ok) router.refresh();
  }

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="mfa-enforcement"
        className="flex items-start justify-between gap-4 rounded-card border border-border bg-surface p-4"
      >
        <div className="space-y-1">
          <h2
            id="mfa-enforcement"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Require MFA for owners and managers
          </h2>
          <p className="text-sm text-muted-foreground">
            When on, an owner or manager must enter a 6-digit code before any
            admin page or action is allowed. Turn it on only once every owner and
            manager has enrolled an authenticator.
          </p>
          {!hasVerified ? (
            <p className="text-sm text-warning">
              You have no enrolled authenticator yet — enrol one below first, or
              you will be locked out.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={requireMfa ? "default" : "secondary"}>
            {requireMfa ? "Enforced" : "Optional"}
          </Badge>
          {requireMfa ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleToggle(false)}
            >
              Turn off enforcement
            </Button>
          ) : (
            <ConfirmDialog
              title="Turn on MFA enforcement?"
              description="Every owner and manager will need a 6-digit code to use the admin panel. Make sure everyone has enrolled first, or they will be locked out."
              confirmLabel="Turn on enforcement"
              trigger={
                <Button type="button" size="sm" disabled={!hasVerified}>
                  Turn on enforcement
                </Button>
              }
              onConfirm={() => handleToggle(true)}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="mfa-enrol" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="mfa-enrol"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Smartphone aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Your authenticator apps
          </h2>
          <p className="text-sm text-muted-foreground">
            Scan the QR code (or paste the secret) into any authenticator app,
            then confirm one code to activate the device.
          </p>
        </div>

        {factors.length > 0 ? (
          <ul className="divide-y divide-border rounded-card border border-border">
            {factors.map((factor) => (
              <li key={factor.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {factor.friendlyName ?? "Authenticator app"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {factor.verified ? "Active" : "Pending confirmation"}
                  </span>
                </span>
                <Badge variant={factor.verified ? "default" : "secondary"}>
                  {factor.verified ? "Verified" : "Unverified"}
                </Badge>
                <ConfirmDialog
                  title="Remove this authenticator?"
                  description="You will not be able to complete two-factor verification with it again."
                  confirmLabel="Remove device"
                  destructive
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove authenticator"
                    >
                      <Trash2
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-4"
                      />
                    </Button>
                  }
                  onConfirm={() => handleUnenroll(factor.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No authenticator is enrolled yet.
          </p>
        )}

        <div className="space-y-4 rounded-card border border-border bg-surface-2/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="device-name">Device name (optional)</Label>
              <Input
                id="device-name"
                value={deviceName}
                maxLength={40}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Phone, Laptop"
                disabled={!!enrollment}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleEnroll}
                disabled={!!enrollment || saving}
              >
                {enrollment ? "Scan to continue…" : "Start enrolment"}
              </Button>
            </div>
          </div>

          {enrollment ? (
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Scan this QR code</span>
                <div className="size-40 overflow-hidden rounded-control border border-border bg-white p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl(enrollment.qrCode)}
                    alt="QR code for authenticator enrolment"
                    className="size-full"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-secret">
                    Or enter this secret manually
                  </Label>
                  <Input
                    id="mfa-secret"
                    readOnly
                    value={enrollment.secret}
                    className="font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-code">Confirm with a 6-digit code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mfa-code"
                      value={code}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      onChange={(e) => setCode(e.target.value)}
                      className="max-w-40 tracking-[0.3em]"
                    />
                    <Button
                      type="button"
                      onClick={handleVerify}
                      disabled={saving}
                    >
                      Activate
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEnrollment(null);
                    setCode("");
                    setLocalError(null);
                  }}
                >
                  Cancel enrolment
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          {localError ? (
            <p
              role="status"
              className="rounded-control border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive"
            >
              {localError}
            </p>
          ) : null}
          <FlashLine flash={flash} />
        </div>
      </section>
    </div>
  );
}

function qrDataUrl(qrCode: string): string {
  if (qrCode.startsWith("data:")) return qrCode;
  return `data:image/svg+xml;utf-8,${qrCode}`;
}

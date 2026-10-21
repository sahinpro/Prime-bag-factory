"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { saveNotificationCron } from "@/app/(admin)/admin/settings/actions";
import { FormSection } from "@/components/admin/forms/form-section";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import {
  FlashLine,
  useActionSave,
} from "@/components/admin/products/use-action-save";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NotificationCron } from "@/server/settings";

/**
 * Notification delivery config (plan §9 Settings, order-of-work step 9). This
 * edits the `settings.notification_cron` row the pg_cron sender reads (C2): the
 * URL of the deployed `/api/cron/send-notifications` route and the shared
 * `CRON_SECRET`. Blank keeps the job inert (no bogus request from local/CI). The
 * secret is masked by default; the audit trail never stores its value.
 */
export function NotificationForm({
  initial,
}: Readonly<{ initial: NotificationCron }>) {
  const { saving, flash, run } = useActionSave();
  const baseline = React.useMemo(
    () => ({ url: initial.url ?? "", secret: initial.secret ?? "" }),
    [initial],
  );
  const [form, setForm] = React.useState(baseline);
  const [reveal, setReveal] = React.useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    return run(
      () => saveNotificationCron(form),
      "Notification settings saved.",
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <FormSection
        title="Scheduled email sender"
        description="Point the pg_cron job at your deployed cron route. Leave both blank to keep the sender idle."
      >
        <div className="space-y-1.5">
          <Label htmlFor="cron-url">Cron route URL</Label>
          <Input
            id="cron-url"
            name="cron_url"
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://your-app.vercel.app/api/cron/send-notifications"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cron-secret">Cron secret</Label>
          <div className="flex items-center gap-2">
            <Input
              id="cron-secret"
              name="cron_secret"
              type={reveal ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              value={form.secret}
              onChange={(e) => set("secret", e.target.value)}
              placeholder="Must equal the CRON_SECRET env var"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={reveal ? "Hide the secret" : "Show the secret"}
              aria-pressed={reveal}
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? (
                <EyeOff
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
              ) : (
                <Eye aria-hidden="true" strokeWidth={1.75} className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored in the settings row and never written to the audit trail.
          </p>
        </div>
      </FormSection>

      <div className="space-y-3 pt-2">
        <FlashLine flash={flash} />
        <StickySaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => {
            void handleSave();
          }}
          onDiscard={() => {
            setForm(baseline);
            setReveal(false);
          }}
        />
      </div>
    </form>
  );
}

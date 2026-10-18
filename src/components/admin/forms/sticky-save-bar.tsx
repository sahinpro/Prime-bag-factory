"use client";

import { Button } from "@/components/ui/button";

/**
 * StickySaveBar (plan 9c.5): appears only when a form is dirty. Save is disabled
 * while submitting. The parent owns the `updated_at` optimistic check and shows a
 * conflict dialog on mismatch.
 */
export function StickySaveBar({
  dirty,
  saving = false,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
}) {
  if (!dirty) return null;

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="sticky bottom-0 z-30 -mx-4 mt-6 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border"
    >
      <p className="text-sm text-muted-foreground">
        <span
          aria-hidden="true"
          className="mr-2 inline-block size-2 rounded-full bg-warning"
        />
        You have unsaved changes.
      </p>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

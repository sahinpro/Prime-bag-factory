"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type SaveFlash = { kind: "error" | "success"; text: string } | null;

/**
 * Shared run/save helper for the product editor tabs. Each tab owns one section
 * of the product and saves it through a dedicated server action; this hook tracks
 * the in-flight state and a status flash (announced via `role="status"`), then
 * refreshes the routed server data on success so the tab re-hydrates from a clean
 * baseline (which also re-computes `dirty`).
 */
export function useActionSave() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [flash, setFlash] = React.useState<SaveFlash>(null);

  async function run(
    action: () => Promise<ActionResult>,
    successText = "Saved.",
  ): Promise<boolean> {
    setSaving(true);
    setFlash(null);
    const result = await action();
    setSaving(false);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return false;
    }
    router.refresh();
    setFlash({ kind: "success", text: successText });
    return true;
  }

  return { saving, flash, setFlash, run };
}

/** A small status region rendered above a tab's save bar. */
export function FlashLine({ flash }: Readonly<{ flash: SaveFlash }>) {
  if (!flash) return null;
  return (
    <div
      role="status"
      className={
        flash.kind === "error"
          ? "rounded-control border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive"
          : "rounded-control border border-success/30 bg-success-soft px-3 py-2 text-sm text-success"
      }
    >
      {flash.text}
    </div>
  );
}

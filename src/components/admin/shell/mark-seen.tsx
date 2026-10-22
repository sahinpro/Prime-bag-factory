"use client";

import { useEffect, useRef } from "react";

import { markSeen } from "@/app/(admin)/admin/actions";

/**
 * Unseen badge marker: mounted on the quote/order detail pages only while
 * `first_viewed_at` is NULL, it calls the `markSeen` action once after mount
 * (a ref guards React 19 StrictMode's double effect) and the action's
 * `updateTag(admin_counts)` drops the sidebar badge. Renders nothing.
 */
export function MarkSeen({
  kind,
  id,
}: Readonly<{ kind: "quote" | "order"; id: string }>) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void markSeen(kind, id);
  }, [kind, id]);

  return null;
}

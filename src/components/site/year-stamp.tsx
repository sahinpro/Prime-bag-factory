"use client";

import { useSyncExternalStore } from "react";

// The clock is an external, ambient source. Subscribing to nothing and reading
// `Date` in the snapshot lets React defer it to the client: the server snapshot
// is empty (so no unstable `new Date()` during the Next 16 prerender) and the
// client snapshot fills in after hydration — no setState-in-effect cascade.
function subscribe() {
  return () => {};
}

export function YearStamp() {
  const year = useSyncExternalStore(
    subscribe,
    () => String(new Date().getFullYear()),
    () => "",
  );

  if (!year) return null;
  return <>{year}</>;
}

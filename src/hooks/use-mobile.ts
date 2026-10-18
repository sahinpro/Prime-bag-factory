import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Track the mobile breakpoint via a media query. Uses useSyncExternalStore so we
 * subscribe to an external source without calling setState inside an effect, and
 * stay hydration-safe by rendering `false` on the server.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    React.useCallback((onChange: () => void) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }, []),
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}

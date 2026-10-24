"use client";

import { cn } from "cn";
import { useEffect, useRef, useState } from "react";

/**
 * Sticky bar. A sentinel above the bar flips the border and shadow after
 * 8px of scroll. IntersectionObserver only — no scroll listener.
 */
export function HeaderFrame({ children }: { children: React.ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(!entry?.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-2 -mb-2" />
      <header
        className={cn(
          "sticky top-0 z-40 bg-background",
          scrolled && "border-b border-border shadow-sm",
        )}
      >
        {children}
      </header>
    </>
  );
}

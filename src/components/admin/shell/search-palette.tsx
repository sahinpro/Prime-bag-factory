"use client";

import * as React from "react";

import { CommandPalette } from "@/components/admin/shell/command-palette";
import type { Role } from "@/lib/auth";

/**
 * SearchPaletteProvider (plan 9c.4): owns the single command-palette instance
 * and its open state so both the sidebar search box and the topbar icon can
 * trigger it, and the Cmd/Ctrl+K shortcut works from anywhere in the shell.
 */
type SearchPaletteValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SearchPaletteContext = React.createContext<SearchPaletteValue | null>(
  null,
);

export function useSearchPalette(): SearchPaletteValue {
  const ctx = React.useContext(SearchPaletteContext);
  if (!ctx) {
    throw new Error(
      "useSearchPalette must be used within SearchPaletteProvider",
    );
  }
  return ctx;
}

export function SearchPaletteProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SearchPaletteContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} role={role} />
    </SearchPaletteContext.Provider>
  );
}

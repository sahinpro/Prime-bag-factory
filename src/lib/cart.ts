"use client";

/**
 * Cart store (plan Phase 5 task 1): client state persisted to localStorage —
 * the plan fixes the cart as "Dynamic / client, no shared cache" (3b). Only
 * {variantId, qty} is stored; every price, MOQ and stock number is re-read
 * from the server when the cart or checkout renders (never trust client
 * money). Exposed to React through useSyncExternalStore with a cached
 * snapshot and an empty server snapshot, so SSR never hydrates cart state.
 */

import { useSyncExternalStore } from "react";

export type CartItem = {
  variantId: string;
  qty: number;
};

const STORAGE_KEY = "pbf-cart-v1";

let items: CartItem[] = read();
const listeners = new Set<() => void>();

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is CartItem =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as CartItem).variantId === "string" &&
          Number.isFinite((entry as CartItem).qty) &&
          (entry as CartItem).qty > 0,
      )
      .map((entry) => ({
        variantId: entry.variantId,
        qty: Math.floor(entry.qty),
      }));
  } catch {
    return [];
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function persist(next: CartItem[]) {
  items = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota: the cart still works for this tab.
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  // Keep multiple tabs on the same cart.
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      items = read();
      emit();
    }
  });
}

const EMPTY: CartItem[] = [];

function getSnapshot(): CartItem[] {
  return items;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

export function getCartItems(): CartItem[] {
  return items;
}

export function addToCart(variantId: string, qty: number) {
  const quantity = Math.max(1, Math.floor(qty) || 1);
  const existing = items.find((i) => i.variantId === variantId);
  persist(
    existing
      ? items.map((i) =>
          i.variantId === variantId ? { ...i, qty: i.qty + quantity } : i,
        )
      : [...items, { variantId, qty: quantity }],
  );
}

export function setCartQty(variantId: string, qty: number) {
  const quantity = Math.floor(qty);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    removeFromCart(variantId);
    return;
  }
  persist(
    items.map((i) =>
      i.variantId === variantId ? { ...i, qty: quantity } : i,
    ),
  );
}

export function removeFromCart(variantId: string) {
  persist(items.filter((i) => i.variantId !== variantId));
}

export function clearCart() {
  persist([]);
}

/** Total pieces in the cart (badge count). */
export function cartCount(snapshot: CartItem[] = items): number {
  return snapshot.reduce((sum, i) => sum + i.qty, 0);
}

/** Reactive hook: stable empty array during SSR and the first client render. */
export function useCartItems(): CartItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

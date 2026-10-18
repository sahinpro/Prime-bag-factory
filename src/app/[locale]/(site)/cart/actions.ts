"use server";

import { z } from "zod";

import { loadCartLines, type CartLine } from "@/server/cart";

/**
 * Public cart hydration action (cart and checkout share it). Inputs are a zod
 * list of uuids; outputs are fresh server-side prices/stock — the client store
 * never decides what anything costs (AGENTS: never trust client totals).
 */

const cartLoadSchema = z.object({
  variantIds: z.array(z.guid()).max(50),
});

export type CartLoadResult =
  | { ok: true; lines: CartLine[]; missing: string[] }
  | { ok: false; error: string };

export async function loadCart(payload: unknown): Promise<CartLoadResult> {
  const parsed = cartLoadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid cart." };
  try {
    const { lines, missing } = await loadCartLines(parsed.data.variantIds);
    return { ok: true, lines, missing };
  } catch {
    return { ok: false, error: "Could not load the cart. Please try again." };
  }
}

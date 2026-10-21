"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  shippingZoneInputSchema,
  shippingZoneUpdateSchema,
  type ShippingZoneInput,
} from "@/lib/validators/shipping";
import { logAudit } from "@/server/audit";

const ZONE_ROLES = ["owner", "manager"] as const;

export type ShippingActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function firstError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "The form has errors.";
}

function toRow(input: ShippingZoneInput) {
  return {
    name_en: input.name_en,
    name_bn: input.name_bn ?? null,
    fee: input.fee,
    free_over: input.free_over ?? null,
    is_active: input.is_active,
  };
}

export async function saveShippingZone(
  payload: ShippingZoneInput & { id?: string },
): Promise<ShippingActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(ZONE_ROLES)).id;
  } catch {
    return {
      ok: false,
      error: "You are not authorized to manage shipping zones.",
    };
  }

  const supabase = await createClient();

  if (payload.id) {
    const parsed = shippingZoneUpdateSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const input = parsed.data;
    const { data, error } = await supabase
      .from("shipping_zones")
      .update(toRow(input))
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "Could not save the shipping zone." };
    await logAudit(supabase, {
      actorId,
      action: "shipping_zone.update",
      tableName: "shipping_zones",
      recordId: input.id,
      diff: {
        fee: input.fee,
        free_over: input.free_over ?? null,
        is_active: input.is_active,
      },
    });
    revalidatePath("/admin/shipping");
    return { ok: true, id: data?.id };
  }

  const parsed = shippingZoneInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;
  const { data, error } = await supabase
    .from("shipping_zones")
    .insert(toRow(input))
    .select("id")
    .single();
  if (error) return { ok: false, error: "Could not create the shipping zone." };
  await logAudit(supabase, {
    actorId,
    action: "shipping_zone.create",
    tableName: "shipping_zones",
    recordId: data.id,
    diff: {
      fee: input.fee,
      free_over: input.free_over ?? null,
      is_active: input.is_active,
    },
  });
  revalidatePath("/admin/shipping");
  return { ok: true, id: data.id };
}

export async function deleteShippingZone(
  id: string,
): Promise<ShippingActionResult> {
  if (!shippingZoneUpdateSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "Invalid shipping zone." };
  }
  let actorId: string;
  try {
    actorId = (await requireRole(ZONE_ROLES)).id;
  } catch {
    return {
      ok: false,
      error: "You are not authorized to manage shipping zones.",
    };
  }

  const supabase = await createClient();

  const { data: self } = await supabase
    .from("shipping_zones")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!self) return { ok: false, error: "Shipping zone not found." };

  // `orders.shipping_zone_id` is a nullable FK with no ON DELETE CASCADE, so Postgres
  // blocks deleting a zone an existing order references. Deactivating (is_active =
  // false) is the non-destructive path; the error below tells the operator that.
  const { error } = await supabase.from("shipping_zones").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This zone is used by existing orders. Deactivate it instead of deleting.",
      };
    }
    return { ok: false, error: "Could not delete the shipping zone." };
  }

  await logAudit(supabase, {
    actorId,
    action: "shipping_zone.delete",
    tableName: "shipping_zones",
    recordId: id,
  });

  revalidatePath("/admin/shipping");
  return { ok: true };
}

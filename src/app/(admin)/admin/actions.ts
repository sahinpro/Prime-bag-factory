"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** End the staff session and return to the login page. */
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Could not sign out.", { cause: error });
  }

  redirect("/admin/login");
}

import { z } from "zod";

import { createAdminClient } from "../src/lib/supabase/admin";

const inputSchema = z.object({
  userId: z.uuid(),
  fullName: z.string().trim().min(2).max(120),
});

const parsed = inputSchema.safeParse({
  userId: process.argv[2],
  fullName: process.argv[3],
});

if (!parsed.success) {
  throw new Error(
    'Usage: bun --conditions=react-server --env-file=.env.local scripts/create-first-owner.ts <auth-user-id> "Full name"',
  );
}

const supabase = createAdminClient();
const { data: authResult, error: authError } =
  await supabase.auth.admin.getUserById(parsed.data.userId);

if (authError) {
  throw new Error("Could not verify the Supabase Auth user.", {
    cause: authError,
  });
}

if (!authResult.user) {
  throw new Error("The supplied Supabase Auth user does not exist.");
}

const { data: existingProfile, error: profileError } = await supabase
  .from("profiles")
  .select("id, role")
  .eq("id", parsed.data.userId)
  .maybeSingle();

if (profileError) {
  throw new Error("Could not load the user's profile.", {
    cause: profileError,
  });
}

if (existingProfile?.role === "owner") {
  console.log("This user is already provisioned as the owner.");
  process.exit(0);
}

const { data: ownerProfile, error: ownerError } = await supabase
  .from("profiles")
  .select("id")
  .eq("role", "owner")
  .limit(1)
  .maybeSingle();

if (ownerError) {
  throw new Error("Could not check for an existing owner.", {
    cause: ownerError,
  });
}

if (ownerProfile) {
  throw new Error("An owner already exists. Use the staff-management flow instead.");
}

if (existingProfile && existingProfile.role !== "customer") {
  throw new Error("Only an existing customer profile can be promoted to owner.");
}

const result = existingProfile
  ? await supabase
      .from("profiles")
      .update({ full_name: parsed.data.fullName, role: "owner" })
      .eq("id", parsed.data.userId)
  : await supabase.from("profiles").insert({
      id: parsed.data.userId,
      full_name: parsed.data.fullName,
      role: "owner",
    });

if (result.error) {
  throw new Error("Could not provision the first owner profile.", {
    cause: result.error,
  });
}

console.log("First owner profile provisioned.");

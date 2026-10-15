import "server-only";
import { z } from "zod";

import { publicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const serverEnv = serverEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

/** Full env for server modules. Importing this file from a client component fails the build. */
export const env = {
  ...publicEnv,
  ...serverEnv,
};

import "server-only";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env.server";
import type { Database } from "@/lib/database.types";

/** Service-role client. Server only. Never import this from a client component. */
export function createAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

import "server-only";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env.server";

/** Service-role client. Server only. Never import this from a client component. */
export function createAdminClient() {
  return createClient(
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

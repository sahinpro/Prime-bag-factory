import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cookie-based server client for authenticated (staff) requests. The signed-in
 * session rides the cookies, so `has_role()` RLS decides what is returned. Using
 * this in a Server Component opts the route into dynamic rendering (it reads
 * cookies), which is correct for admin but wrong for cacheable public pages.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component. Middleware or a Server Action can set cookies.
          }
        },
      },
    },
  );
}

/**
 * Cookie-free, anon-key server client for the PUBLIC catalog. It runs under the
 * Postgres `anon` role so RLS still decides visibility (published products,
 * active categories), but because it never touches cookies a Server Component
 * using it can stay Static / ISR and be refreshed with `revalidateTag`. Read
 * paths only — writes go through the session client in server actions.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

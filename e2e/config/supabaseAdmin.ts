import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * Supabase admin client for E2E test state injection.
 * Uses the service_role key to bypass RLS policies entirely.
 *
 * @returns Supabase client with admin privileges
 * @throws {Error} If required environment variables are missing
 */
const createAdminClient = (): SupabaseClient => {
  const supabaseUrl =
    process.env.E2E_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "";

  const serviceRoleKey =
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl) {
    throw new Error(
      "E2E setup: Missing E2E_SUPABASE_URL or VITE_SUPABASE_URL"
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "E2E setup: Missing E2E_SUPABASE_SERVICE_ROLE_KEY. " +
        "This key is required to bypass RLS for state injection."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

let _client: SupabaseClient | null = null;
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) _client = createAdminClient();
    return (_client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

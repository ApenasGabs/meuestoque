import { supabaseAdmin } from "../config/supabaseAdmin";

interface SeedTestUserResult {
  userId: string;
  email: string;
}

interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

/**
 * Creates a test user directly via Supabase Admin API (bypasses email confirmation).
 *
 * @param email - User email
 * @param password - User password
 * @param name - Display name stored in user_metadata and profiles
 * @returns Created user ID and email
 * @throws {Error} If user creation fails
 */
export const seedTestUser = async (
  email: string,
  password: string,
  name: string
): Promise<SeedTestUserResult> => {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: name },
  });

  if (error) {
    throw new Error(`seedTestUser failed: ${error.message}`);
  }

  // Ensure profile row exists (trigger may handle this, but we guarantee it)
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: data.user.id, nome: name }, { onConflict: "id" });

  if (profileError) {
    throw new Error(`seedTestUser (profile upsert): ${profileError.message}`);
  }

  return { userId: data.user.id, email };
};

/**
 * Removes a test user and all associated data (cascaded via FK constraints).
 *
 * @param userId - User UUID to clean up
 */
export const cleanupTestUser = async (userId: string): Promise<void> => {
  // Remove from group_members first (may not cascade from auth.users)
  await supabaseAdmin
    .from("group_members")
    .delete()
    .eq("user_id", userId);

  // Remove profile
  await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", userId);

  // Delete auth user (this is the admin API)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    console.warn(`cleanupTestUser warning: ${error.message}`);
  }
};

/**
 * Authenticates a test user and returns session tokens.
 * Useful for injecting auth state into Playwright browser context.
 *
 * @param email - User email
 * @param password - User password
 * @returns Session tokens and user ID
 * @throws {Error} If authentication fails
 */
export const getAuthSession = async (
  email: string,
  password: string
): Promise<AuthSessionResult> => {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`getAuthSession failed: ${error.message}`);
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user.id,
  };
};

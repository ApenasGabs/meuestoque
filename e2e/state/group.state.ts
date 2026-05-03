import { supabaseAdmin } from "../config/supabaseAdmin";
import { seedTestUser, getAuthSession } from "./auth.state";

interface SeedGroupResult {
  groupId: string;
  inviteCode: string;
}

interface SeedUserInGroupResult {
  memberId: string;
}

interface SeedFullContextResult {
  userId: string;
  email: string;
  groupId: string;
  listId: string;
  inviteCode: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Creates a group with an auto-generated invite code.
 *
 * @param name - Group display name
 * @returns Group ID and invite code
 * @throws {Error} If group creation fails
 */
export const seedGroup = async (name: string): Promise<SeedGroupResult> => {
  const { data, error } = await supabaseAdmin
    .from("groups")
    .insert({ nome: name })
    .select("id, codigo_convite")
    .single();

  if (error) {
    throw new Error(`seedGroup failed: ${error.message}`);
  }

  return { groupId: data.id, inviteCode: data.codigo_convite };
};

/**
 * Adds a user as a member of an existing group.
 *
 * @param userId - Auth user UUID
 * @param groupId - Target group UUID
 * @returns Membership record ID
 * @throws {Error} If membership insertion fails
 */
export const seedUserInGroup = async (
  userId: string,
  groupId: string
): Promise<SeedUserInGroupResult> => {
  const { data, error } = await supabaseAdmin
    .from("group_members")
    .insert({ user_id: userId, group_id: groupId })
    .select("id")
    .single();

  if (error) {
    throw new Error(`seedUserInGroup failed: ${error.message}`);
  }

  return { memberId: data.id };
};

/**
 * Creates a complete test context: user + group + membership + active shopping list.
 * This is the most commonly used seed function — covers the bootstrap for ~80% of tests.
 *
 * @param email - Test user email
 * @param password - Test user password
 * @param userName - Display name
 * @param groupName - Group name
 * @returns Full context with IDs and auth tokens
 * @throws {Error} If any step fails
 */
export const seedFullContext = async (
  email: string,
  password: string,
  userName: string,
  groupName: string
): Promise<SeedFullContextResult> => {
  // 1. Create user and ensure profile via delegated state
  const { userId } = await seedTestUser(email, password, userName);

  // 3. Create group
  const { data: groupData, error: groupError } = await supabaseAdmin
    .from("groups")
    .insert({ nome: groupName })
    .select("id, codigo_convite")
    .single();

  if (groupError) {
    throw new Error(`seedFullContext (group): ${groupError.message}`);
  }

  const groupId = groupData.id;
  const inviteCode = groupData.codigo_convite;

  // 4. Add user to group
  await supabaseAdmin
    .from("group_members")
    .insert({ user_id: userId, group_id: groupId });

  // 5. Create active shopping list
  const { data: listData, error: listError } = await supabaseAdmin
    .from("shopping_lists")
    .insert({ group_id: groupId, ativa: true, status: "active" })
    .select("id")
    .single();

  if (listError) {
    throw new Error(`seedFullContext (list): ${listError.message}`);
  }

  // 6. Get auth session for browser injection
  const { accessToken, refreshToken } = await getAuthSession(email, password);

  return {
    userId,
    email,
    groupId,
    listId: listData.id,
    inviteCode,
    accessToken,
    refreshToken,
  };
};

/**
 * Deletes a group and all cascaded data (members, lists, items, stock).
 *
 * @param groupId - Group UUID to clean up
 */
export const cleanupGroup = async (groupId: string): Promise<void> => {
  // stock_movements → stock_lots → stock_items cascade via FK
  // items → shopping_lists cascade via FK
  // group_members cascade via FK
  const { error } = await supabaseAdmin
    .from("groups")
    .delete()
    .eq("id", groupId);

  if (error) {
    console.warn(`cleanupGroup warning: ${error.message}`);
  }
};

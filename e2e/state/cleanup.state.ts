import { supabaseAdmin } from "../config/supabaseAdmin";
import { cleanupTestUser } from "./auth.state";
import { cleanupGroup } from "./group.state";
import { cleanupGroupStock } from "./stock.state";

/**
 * Full cleanup: removes all test data for a user + group pair.
 * Intended for afterAll blocks to guarantee no data leaks between test suites.
 *
 * @param userId - Auth user UUID
 * @param groupId - Group UUID
 */
export const cleanupAll = async (
  userId: string,
  groupId: string
): Promise<void> => {
  // Order matters: clean leaf tables first, then parents

  // 1. Stock data (movements → lots → items → catalog)
  await cleanupGroupStock(groupId);

  // 2. Shopping list items
  const { data: lists } = await supabaseAdmin
    .from("shopping_lists")
    .select("id")
    .eq("group_id", groupId);

  if (lists && lists.length > 0) {
    const listIds = lists.map((list) => list.id);
    await supabaseAdmin
      .from("items")
      .delete()
      .in("list_id", listIds);
  }

  // 3. Shopping lists themselves
  await supabaseAdmin
    .from("shopping_lists")
    .delete()
    .eq("group_id", groupId);

  // 4. Group (cascades group_members)
  await cleanupGroup(groupId);

  // 5. User
  await cleanupTestUser(userId);
};

/**
 * Resets data within a group while preserving the group and its members.
 * Useful for beforeEach blocks where you want fresh lists/stock but keep auth context.
 *
 * @param groupId - Group UUID to reset
 */
export const resetGroupData = async (groupId: string): Promise<void> => {
  // 1. Clean stock
  await cleanupGroupStock(groupId);

  // 2. Clean list items
  const { data: lists } = await supabaseAdmin
    .from("shopping_lists")
    .select("id")
    .eq("group_id", groupId);

  if (lists && lists.length > 0) {
    const listIds = lists.map((list) => list.id);
    await supabaseAdmin
      .from("items")
      .delete()
      .in("list_id", listIds);
  }

  // 3. Clean lists
  await supabaseAdmin
    .from("shopping_lists")
    .delete()
    .eq("group_id", groupId);
};

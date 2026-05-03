import { supabaseAdmin } from "../config/supabaseAdmin";

interface ListItemInput {
  nome: string;
  quantidade: string;
  categoria?: string;
  preco?: number;
  comprado?: boolean;
}

interface SeedActiveListResult {
  listId: string;
}

interface SeedListWithItemsResult {
  listId: string;
  itemIds: string[];
}

/**
 * Creates an active shopping list for a group.
 *
 * @param groupId - Target group UUID
 * @returns Active list ID
 * @throws {Error} If list creation fails
 */
export const seedActiveList = async (
  groupId: string
): Promise<SeedActiveListResult> => {
  const { data, error } = await supabaseAdmin
    .from("shopping_lists")
    .insert({ group_id: groupId, ativa: true, status: "active" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`seedActiveList failed: ${error.message}`);
  }

  return { listId: data.id };
};

/**
 * Creates an active list with unchecked items ready for shopping.
 *
 * @param groupId - Target group UUID
 * @param items - Array of item definitions
 * @returns List ID and array of created item IDs
 * @throws {Error} If list or item creation fails
 */
export const seedListWithItems = async (
  groupId: string,
  items: ListItemInput[]
): Promise<SeedListWithItemsResult> => {
  const { listId } = await seedActiveList(groupId);

  const itemsToInsert = items.map((item) => ({
    list_id: listId,
    nome: item.nome,
    quantidade: item.quantidade,
    categoria: item.categoria ?? "Outros",
    preco: item.preco ?? null,
    comprado: item.comprado ?? false,
  }));

  const { data, error } = await supabaseAdmin
    .from("items")
    .insert(itemsToInsert)
    .select("id");

  if (error) {
    throw new Error(`seedListWithItems failed: ${error.message}`);
  }

  return {
    listId,
    itemIds: (data ?? []).map((row) => row.id),
  };
};

/**
 * Inserts checked (purchased) items into an existing list.
 * Useful for testing finalization flows.
 *
 * @param listId - Target list UUID
 * @param items - Items to insert as already purchased
 * @returns Array of created item IDs
 * @throws {Error} If insertion fails
 */
export const seedCheckedListItems = async (
  listId: string,
  items: ListItemInput[]
): Promise<{ itemIds: string[] }> => {
  const itemsToInsert = items.map((item) => ({
    list_id: listId,
    nome: item.nome,
    quantidade: item.quantidade,
    categoria: item.categoria ?? "Outros",
    preco: item.preco ?? null,
    comprado: true,
  }));

  const { data, error } = await supabaseAdmin
    .from("items")
    .insert(itemsToInsert)
    .select("id");

  if (error) {
    throw new Error(`seedCheckedListItems failed: ${error.message}`);
  }

  return { itemIds: (data ?? []).map((row) => row.id) };
};

/**
 * Creates a finalized (closed) shopping list with purchased items.
 * Simulates a past completed purchase for history tests.
 *
 * @param groupId - Target group UUID
 * @param items - Items that were "purchased"
 * @param purchaseDate - ISO date string (e.g., "2026-04-15")
 * @returns Finalized list ID
 * @throws {Error} If creation fails
 */
export const seedFinalizedList = async (
  groupId: string,
  items: ListItemInput[],
  purchaseDate?: string
): Promise<{ listId: string }> => {
  const now = new Date().toISOString();
  const dateStr = purchaseDate ?? new Date().toISOString().slice(0, 10);

  const { data: listData, error: listError } = await supabaseAdmin
    .from("shopping_lists")
    .insert({
      group_id: groupId,
      ativa: false,
      status: "closed",
      finalizada_em: now,
      finalized_at: now,
      closed_purchase_date: dateStr,
      total: items.reduce((sum, item) => sum + (item.preco ?? 0), 0) || null,
    })
    .select("id")
    .single();

  if (listError) {
    throw new Error(`seedFinalizedList failed: ${listError.message}`);
  }

  const itemsToInsert = items.map((item) => ({
    list_id: listData.id,
    nome: item.nome,
    quantidade: item.quantidade,
    categoria: item.categoria ?? "Outros",
    preco: item.preco ?? null,
    comprado: true,
  }));

  await supabaseAdmin.from("items").insert(itemsToInsert);

  return { listId: listData.id };
};

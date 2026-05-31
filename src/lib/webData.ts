import { normalizeInviteCode } from "../domain/listRules";
import { pickActiveGroup, type GroupRecord } from "../domain/sessionRules";
import { supabase } from "./supabase";
import { toUnit, type Unit } from "../types/inventory.types";

export interface UserSessionData {
  id: string;
  name: string;
}

export interface ShoppingListRecord {
  id: string;
  ativa: boolean;
  finalizada_em: string | null;
  closed_purchase_date: string | null;
  total: number | null;
  group_id: string;
  items?: ItemRecord[];
}

export interface ItemRecord {
  id: string;
  nome: string;
  quantidade: string;
  categoria: string;
  comprado: boolean;
  preco: number | null;
  preco_unitario: number | null;
  preco_total: number | null;
  quantidade_num: number | null;
  unidade?: Unit;
  criado_por: string | null;
  list_id: string;
  criado_em: string | null;
  data_validade?: string | null;
  nao_aplica_validade?: boolean;
  product_id?: string | null;
  /** Embalagem informada na compra (ex: "pacote", "caixa") */
  pack_label?: string | null;
  /** Rendimento por embalagem em unidade de estoque (ex: 5 para 5 kg) */
  pack_size?: number | null;
  /** Unidade do rendimento (ex: "Kg", "g", "Un") */
  pack_unit?: string | null;
}

interface FinalizeShoppingRpcResult {
  next_list_id: string | null;
  bought_items_count: number;
  pending_items_count: number;
  finalized_total: number | null;
}

export interface MemberRecord {
  id: string;
  nome: string;
}

export const getCurrentUser = async (): Promise<UserSessionData | null> => {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  return {
    id: user.id,
    name: user.user_metadata?.nome ?? user.email ?? "",
  };
};

export const getSessionUser = async (): Promise<UserSessionData | null> => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;

  return {
    id: user.id,
    name: user.user_metadata?.nome ?? user.email ?? "",
  };
};

export const loadUserGroups = async (userId: string): Promise<GroupRecord[]> => {
  const { data, error } = await supabase
    .from("groups")
    .select("id, nome, codigo_convite, created_by, group_members!inner(user_id)")
    .eq("group_members.user_id", userId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((group) => ({
    id: group.id,
    nome: group.nome,
    codigo_convite: group.codigo_convite,
    created_by: group.created_by,
  }));
};

export const restoreGroupContext = async (userId: string, savedGroupId: string | null) => {
  const groups = await loadUserGroups(userId);
  const activeGroup = pickActiveGroup(groups, savedGroupId);

  if (!activeGroup) {
    return { groups: [], group: null, listId: null };
  }

  const { data: listData, error } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("group_id", activeGroup.id)
    .eq("ativa", true)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return {
    groups,
    group: activeGroup,
    listId: listData?.[0]?.id ?? null,
  };
};

export const loadMembers = async (groupId: string): Promise<MemberRecord[]> => {
  const { data: memberData, error: membersError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);

  if (membersError) throw new Error(membersError.message);

  const userIds = (memberData ?? []).map((member) => member.user_id);
  if (userIds.length === 0) return [];

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", userIds);

  if (profileError) throw new Error(profileError.message);

  return (profileData ?? []).map((profile) => ({
    id: profile.id,
    nome: profile.nome ?? "Usuário",
  }));
};

export const loadActiveList = async (groupId: string): Promise<ShoppingListRecord | null> => {
  // Query both ativa=true and status='active' to handle any data inconsistency.
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("id, ativa, finalizada_em, closed_purchase_date, total, group_id")
    .eq("group_id", groupId)
    .or("ativa.eq.true,status.eq.active")
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
};

const isActiveShoppingListUniqueViolation = (message: string): boolean => {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("idx_shopping_lists_active_group") ||
    normalizedMessage.includes("ux_shopping_lists_group_active") ||
    (normalizedMessage.includes("duplicate key") && normalizedMessage.includes("shopping_lists"))
  );
};

/**
 * Close any orphaned active lists for the group that may exist due to
 * data inconsistency between `ativa` and `status` columns.
 *
 * @param groupId - The group UUID
 * @param excludeListId - Optional list ID to skip during update
 */
const closeOrphanedActiveLists = async (groupId: string, excludeListId?: string): Promise<void> => {
  let query = supabase
    .from("shopping_lists")
    .update({
      ativa: false,
      status: "closed",
      finalizada_em: new Date().toISOString(),
    })
    .eq("group_id", groupId)
    .or("ativa.eq.true,status.eq.active");

  if (excludeListId) {
    query = query.neq("id", excludeListId);
  }

  await query;
};

export async function ensureActiveListForGroup(groupId: string): Promise<ShoppingListRecord> {
  const existing = await loadActiveList(groupId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ group_id: groupId, ativa: true, status: "active" })
    .select("id, ativa, finalizada_em, closed_purchase_date, total, group_id")
    .maybeSingle();

  if (error) {
    if (isActiveShoppingListUniqueViolation(error.message)) {
      // Another concurrent request might have created the list, try to find it.
      const concurrentList = await loadActiveList(groupId);
      if (concurrentList) return concurrentList;

      // If we still can't find an active list, there might be orphaned rows
      // blocking the unique constraint. Close them and retry once.
      await closeOrphanedActiveLists(groupId);

      const { data: retryData, error: retryError } = await supabase
        .from("shopping_lists")
        .insert({ group_id: groupId, ativa: true, status: "active" })
        .select("id, ativa, finalizada_em, closed_purchase_date, total, group_id")
        .maybeSingle();

      if (retryError) {
        // One more attempt to find an existing list after the retry insert failed.
        const lastChanceList = await loadActiveList(groupId);
        if (lastChanceList) return lastChanceList;
        throw new Error(retryError.message);
      }
      if (retryData) return retryData;
    }

    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Não foi possível criar a lista ativa do grupo");
  }
  return data;
}

export async function loadListItems(listId: string): Promise<ItemRecord[]> {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, nome, quantidade, quantidade_num, unidade, categoria, comprado, preco, preco_unitario, preco_total, criado_por, list_id, criado_em, data_validade, nao_aplica_validade, product_id, pack_label, pack_size, pack_unit",
    )
    .eq("list_id", listId)
    .order("criado_em", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRecord[];
}

export interface AddListItemInput {
  listId: string;
  nome: string;
  quantidade: string;
  categoria: string;
  price?: number | null;
  createdBy?: string | null;
  /** Embalagem informada na compra (ex: "pacote") */
  packLabel?: string | null;
  /** Rendimento por embalagem em unidade de estoque */
  packSize?: number | null;
  /** Unidade do rendimento (ex: "Kg", "g") */
  packUnit?: string | null;
}

export async function addListItem(input: AddListItemInput): Promise<void> {
  const parsed = parseListQuantityLabel(input.quantidade);
  const { error } = await supabase.from("items").insert({
    list_id: input.listId,
    nome: input.nome,
    quantidade: input.quantidade,
    quantidade_raw: input.quantidade,
    quantidade_num: parsed.quantidade,
    unidade: parsed.unidade,
    categoria: input.categoria,
    preco: input.price ?? null,
    comprado: false,
    criado_por: input.createdBy ?? null,
    pack_label: input.packLabel ?? null,
    pack_size: input.packSize ?? null,
    pack_unit: input.packUnit ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function toggleListItemPurchased(itemId: string, purchased: boolean): Promise<void> {
  const { error } = await supabase.from("items").update({ comprado: purchased }).eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function updateListItemPrice(itemId: string, price: number | null): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({ preco: price, preco_total: price, preco_unitario: null })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}

/**
 * Updates the unit price (R$/unit) of an item and calculates preco_total automatically.
 * Used when the user enters price-per-kg or price-per-unit instead of a total.
 */
export async function updateListItemUnitPrice(
  itemId: string,
  unitPrice: number | null,
  quantityNum: number,
): Promise<void> {
  const precoTotal =
    unitPrice !== null && quantityNum > 0 ? Math.round(unitPrice * quantityNum * 100) / 100 : null;

  const { error } = await supabase
    .from("items")
    .update({ preco_unitario: unitPrice, preco_total: precoTotal, preco: precoTotal })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function updateListItemQuantity(itemId: string, quantity: string): Promise<void> {
  const parsed = parseListQuantityLabel(quantity);
  const { error } = await supabase
    .from("items")
    .update({
      quantidade: quantity,
      quantidade_raw: quantity,
      quantidade_num: parsed.quantidade,
      unidade: parsed.unidade,
    })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function deleteListItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function deleteListItemsBulk(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  const { error } = await supabase.from("items").delete().in("id", itemIds);

  if (error) throw new Error(error.message);
}

/**
 * Updates the expiration date or sets the non-perishable flag for an item in the active shopping list.
 * This is used to persist temporary validity choices before checkout.
 *
 * @param itemId - The UUID of the shopping list item.
 * @param validityDate - The expiration date in YYYY-MM-DD format, or null to clear.
 * @param naoAplicaValidade - Optional flag indicating the item does not expire.
 */
export async function updateListItemValidityDate(
  itemId: string,
  validityDate: string | null,
  naoAplicaValidade?: boolean,
): Promise<void> {
  const updateData: { data_validade: string | null; nao_aplica_validade?: boolean } = {
    data_validade: validityDate,
  };
  if (naoAplicaValidade !== undefined) {
    updateData.nao_aplica_validade = naoAplicaValidade;
  }

  const { error } = await supabase.from("items").update(updateData).eq("id", itemId);

  if (error) throw new Error(error.message);
}

/**
 * Updates the pack/package conversion info for a shopping list item.
 * This defines how many base units fit in each purchased package.
 *
 * @param itemId - UUID of the shopping list item
 * @param packLabel - Package name (ex: "pacote", "caixa") — null to clear
 * @param packSize - How many base units per package (ex: 5 for 5 kg) — null to clear
 * @param packUnit - Unit of the pack size (ex: "Kg", "g", "Un") — null to clear
 */
export async function updateListItemPackSize(
  itemId: string,
  packLabel: string | null,
  packSize: number | null,
  packUnit: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({ pack_label: packLabel, pack_size: packSize, pack_unit: packUnit })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function duplicateShoppingListToActive(
  groupId: string,
  sourceListId: string,
  createdBy?: string | null,
): Promise<{ targetListId: string; duplicatedCount: number }> {
  const sourceItems = await loadListItems(sourceListId);
  const activeList = await ensureActiveListForGroup(groupId);

  if (sourceItems.length === 0) {
    return { targetListId: activeList.id, duplicatedCount: 0 };
  }

  const targetItems = await loadListItems(activeList.id);
  const existingKeys = new Set(
    targetItems.map((item) => {
      return `${item.nome.trim().toLowerCase()}::${item.quantidade.trim().toLowerCase()}::${item.categoria.trim().toLowerCase()}`;
    }),
  );

  const itemsToInsert = sourceItems
    .filter((item) => {
      const key = `${item.nome.trim().toLowerCase()}::${item.quantidade.trim().toLowerCase()}::${item.categoria.trim().toLowerCase()}`;
      return !existingKeys.has(key);
    })
    .map((item) => ({
      list_id: activeList.id,
      nome: item.nome,
      quantidade: item.quantidade,
      categoria: item.categoria,
      preco: item.preco,
      comprado: false,
      criado_por: createdBy ?? item.criado_por ?? null,
    }));

  if (itemsToInsert.length === 0) {
    return { targetListId: activeList.id, duplicatedCount: 0 };
  }

  const { error } = await supabase.from("items").insert(itemsToInsert);

  if (error) {
    throw new Error(error.message);
  }

  return { targetListId: activeList.id, duplicatedCount: itemsToInsert.length };
}

const parseListQuantityLabel = (rawQuantity: string): { quantidade: number; unidade: Unit } => {
  const normalized = rawQuantity.trim().replace(/\s+/g, " ");
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)(?:\s+([a-zA-Z]+))?$/);

  if (!match) {
    return { quantidade: 1, unidade: "Un" };
  }

  const parsedQuantity = Number.parseFloat(match[1].replace(",", "."));
  const quantidade = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;

  return {
    quantidade,
    unidade: toUnit(match[2]),
  };
};

export async function finishShoppingList(listId: string, groupId: string): Promise<string | null> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("rpc_finalize_shopping_list", {
      p_list_id: listId,
      p_purchase_date: new Date().toISOString().slice(0, 10),
    });

    if (rpcError) {
      console.warn("Erro retornado pela RPC rpc_finalize_shopping_list:", rpcError);
    }

    if (!rpcError && rpcData) {
      const normalizedRpcData = Array.isArray(rpcData)
        ? (rpcData[0] as FinalizeShoppingRpcResult | undefined)
        : (rpcData as FinalizeShoppingRpcResult);

      if (normalizedRpcData?.next_list_id) {
        return normalizedRpcData.next_list_id;
      }
    }
  } catch (err) {
    console.warn("Falha ao executar rpc_finalize_shopping_list, usando fallback:", err);
    // Fallback para implementação legada quando a RPC ainda não estiver disponível.
  }

  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select(
      "id, nome, quantidade, quantidade_num, unidade, categoria, comprado, preco, preco_unitario, preco_total, criado_por, data_validade, pack_label, pack_size, pack_unit",
    )
    .eq("list_id", listId);

  if (itemsError) throw new Error(itemsError.message);

  const todayDate = new Date().toISOString().slice(0, 10);
  // Prefer preco_total (unit-price-based) over preco (manually entered total) for accuracy.
  const total = (items ?? []).reduce((sum, item) => sum + (item.preco_total ?? item.preco ?? 0), 0);

  const boughtItems = (items ?? []).filter((item) => item.comprado);
  const pendingItems = (items ?? []).filter((item) => !item.comprado);
  const sourceItems = boughtItems;

  if (sourceItems.length > 0) {
    const currentStockItems = await getStockItems(groupId);
    const stockByKey = new Map(
      currentStockItems.map((stockItem) => [
        `${stockItem.nome.trim().toLowerCase()}::${stockItem.unidade.toLowerCase()}`,
        stockItem,
      ]),
    );
    type AggregatedStockUpdate = {
      key: string;
      nome: string;
      categoria: string | null | undefined;
      unidade: Unit;
      quantidade: number;
    };
    const aggregatedStockUpdates = new Map<string, AggregatedStockUpdate>();

    const stockItemsArr = Array.from(stockByKey.values());

    for (const boughtItem of sourceItems) {
      const parsed = parseListQuantityLabel(boughtItem.quantidade);
      if (parsed.quantidade <= 0) continue;

      const itemName = boughtItem.nome.trim().toLowerCase();
      const itemUnit = parsed.unidade.toLowerCase();

      let key = `${itemName}::${itemUnit}`;
      let matchedStockItem = stockByKey.get(key);

      let isPackConversion = false;
      let conversionFactor = 1;

      // Priority 1: item has explicit pack_size (informed by user in the shopping list)
      if (boughtItem.pack_size && boughtItem.pack_size > 0) {
        isPackConversion = true;
        conversionFactor = boughtItem.pack_size;
        // The stock unit is the pack_unit from the item (e.g., "Kg") or infer from stock
        const stockUnit = (boughtItem.pack_unit ?? "").toLowerCase();
        // Try to match by name + pack_unit as the base unit
        if (!matchedStockItem && stockUnit) {
          matchedStockItem = stockItemsArr.find(
            (si) => si.nome.trim().toLowerCase() === itemName && si.unidade.toLowerCase() === stockUnit,
          );
          if (matchedStockItem) {
            key = `${itemName}::${matchedStockItem.unidade.toLowerCase()}`;
          }
        }
        if (!matchedStockItem) {
          // Fallback: match by name only and use first result
          matchedStockItem = stockItemsArr.find((si) => si.nome.trim().toLowerCase() === itemName);
          if (matchedStockItem) {
            key = `${itemName}::${matchedStockItem.unidade.toLowerCase()}`;
          }
        }
      } else if (!matchedStockItem) {
        // Priority 2: match by pack_label on stock_items (legacy behavior)
        matchedStockItem = stockItemsArr.find(
          (si) =>
            si.nome.trim().toLowerCase() === itemName &&
            si.pack_label?.trim().toLowerCase() === itemUnit,
        );

        if (matchedStockItem && matchedStockItem.pack_size) {
          isPackConversion = true;
          conversionFactor = matchedStockItem.pack_size;
          key = `${itemName}::${matchedStockItem.unidade.toLowerCase()}`;
        }
      }

      const finalQuantity = parsed.quantidade * conversionFactor;
      const existingAggregatedUpdate = aggregatedStockUpdates.get(key);

      if (existingAggregatedUpdate) {
        existingAggregatedUpdate.quantidade += finalQuantity;
        continue;
      }

      aggregatedStockUpdates.set(key, {
        key,
        nome: boughtItem.nome,
        categoria: boughtItem.categoria,
        unidade:
          isPackConversion && matchedStockItem
            ? (matchedStockItem.unidade as Unit)
            : (parsed.unidade as Unit),
        quantidade: finalQuantity,
      });
    }

    const savedStockItems = await Promise.all(
      Array.from(aggregatedStockUpdates.values()).map(async (aggregatedUpdate) => {
        const existingStockItem = stockByKey.get(aggregatedUpdate.key);

        return upsertStockItem({
          id: existingStockItem?.id,
          groupId,
          nome: aggregatedUpdate.nome,
          categoria: existingStockItem?.categoria ?? aggregatedUpdate.categoria ?? "Outros",
          unidade: aggregatedUpdate.unidade,
          quantidade: (existingStockItem?.quantidade ?? 0) + aggregatedUpdate.quantidade,
          quantidadeMinima: existingStockItem?.quantidade_minima ?? 0,
          tamanhoPorcao: existingStockItem?.tamanho_porcao ?? 1,
          autoAdicionarLista: existingStockItem?.auto_adicionar_lista ?? false,
          consumoFrequencia: existingStockItem?.consumo_frequencia ?? "weekly",
          consumoValor: existingStockItem?.consumo_valor ?? 0,
          dataCompra: todayDate,
          dataValidade: existingStockItem?.data_validade ?? null,
        });
      }),
    );

    for (const savedStockItem of savedStockItems) {
      const key = `${savedStockItem.nome.trim().toLowerCase()}::${savedStockItem.unidade.toLowerCase()}`;
      stockByKey.set(key, savedStockItem);
    }

    // Create stock lots and movements for each bought item (mirrors RPC behavior)
    for (const boughtItem of sourceItems) {
      const parsed = parseListQuantityLabel(boughtItem.quantidade);
      if (parsed.quantidade <= 0) continue;

      const itemName = boughtItem.nome.trim().toLowerCase();
      const itemUnit = parsed.unidade.toLowerCase();

      let isPackConversion = false;
      let conversionFactor = 1;

      const stockItemsArr = Array.from(stockByKey.values());
      let matchedStockItem = stockItemsArr.find(
        (si) => si.nome.trim().toLowerCase() === itemName && si.unidade.toLowerCase() === itemUnit,
      );

      // Priority 1: use pack_size explicitly informed in the list item
      if (boughtItem.pack_size && boughtItem.pack_size > 0) {
        isPackConversion = true;
        conversionFactor = boughtItem.pack_size;
        const stockUnit = (boughtItem.pack_unit ?? "").toLowerCase();
        if (!matchedStockItem && stockUnit) {
          matchedStockItem = stockItemsArr.find(
            (si) => si.nome.trim().toLowerCase() === itemName && si.unidade.toLowerCase() === stockUnit,
          );
        }
        if (!matchedStockItem) {
          matchedStockItem = stockItemsArr.find((si) => si.nome.trim().toLowerCase() === itemName);
        }
      } else if (!matchedStockItem) {
        // Priority 2: legacy pack_label on stock_items
        matchedStockItem = stockItemsArr.find(
          (si) =>
            si.nome.trim().toLowerCase() === itemName &&
            si.pack_label?.trim().toLowerCase() === itemUnit,
        );
        if (matchedStockItem && matchedStockItem.pack_size) {
          isPackConversion = true;
          conversionFactor = matchedStockItem.pack_size;
        }
      }

      if (!matchedStockItem) continue;

      const finalQuantity = parsed.quantidade * conversionFactor;
      const finalUnit = matchedStockItem.unidade;

      const precoTotal = boughtItem.preco_total ?? boughtItem.preco ?? null;
      const precoUnitario =
        boughtItem.preco_unitario ??
        (precoTotal != null && parsed.quantidade > 0
          ? Math.round((precoTotal / parsed.quantidade) * 100) / 100
          : null);

      const precoUnitarioConvertido =
        isPackConversion && precoTotal != null && finalQuantity > 0
          ? Math.round((precoTotal / finalQuantity) * 100) / 100
          : precoUnitario;

      try {
        const lot = await createStockLot({
          stockItemId: matchedStockItem.id,
          sourceListItemId: boughtItem.id,
          quantidade: finalQuantity,
          unidade: finalUnit,
          custoUnitario: precoUnitarioConvertido,
          custoTotal: precoTotal != null ? precoTotal : null,
          dataCompra: todayDate,
          dataValidade: boughtItem.data_validade ?? null,
          createdBy: boughtItem.criado_por,
        });

        await recordStockMovement({
          itemId: matchedStockItem.id,
          tipo: "entrada",
          quantidade: finalQuantity,
          observacao: isPackConversion
            ? `Entrada por compra de ${parsed.quantidade} ${parsed.unidade} (convertido para ${finalUnit})`
            : "Entrada por finalização de compra",
          createdBy: boughtItem.criado_por,
          lotId: lot.id,
          unidade: finalUnit,
          custoUnitarioRef: precoUnitarioConvertido,
          origem: "list_finalize",
          sourceListId: listId,
          sourceListItemId: boughtItem.id,
        });
      } catch (lotError) {
        // Non-critical: if lot creation fails, the stock item quantity was already updated
        console.warn("Falha ao criar lote para item:", boughtItem.nome, lotError);
      }
    }
  }

  // Close the current list AND any other orphaned active lists for this group.
  // This prevents unique constraint violations from stale data.
  const { error: updateError } = await supabase
    .from("shopping_lists")
    .update({
      ativa: false,
      status: "closed",
      finalizada_em: new Date().toISOString(),
      closed_purchase_date: todayDate,
      total: total > 0 ? total : null,
    })
    .eq("id", listId);

  if (updateError) throw new Error(updateError.message);

  // Also close any other orphaned active lists for the group to avoid constraint conflicts.
  await closeOrphanedActiveLists(groupId);

  const nextList = await ensureActiveListForGroup(groupId);

  if (pendingItems.length > 0) {
    const { error: pendingInsertError } = await supabase.from("items").insert(
      pendingItems.map((item) => ({
        list_id: nextList.id,
        nome: item.nome,
        quantidade: item.quantidade,
        categoria: item.categoria,
        preco: item.preco,
        comprado: false,
        criado_por: item.criado_por,
      })),
    );

    if (pendingInsertError) {
      throw new Error(pendingInsertError.message);
    }
  }

  return nextList.id;
}

export async function loadShoppingHistory(groupId: string): Promise<ShoppingListRecord[]> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("id, ativa, finalizada_em, closed_purchase_date, total, group_id, items(*)")
    .eq("group_id", groupId)
    .eq("ativa", false)
    .order("finalizada_em", { ascending: false });

  if (error) throw new Error(error.message);

  const records = (data ?? []) as ShoppingListRecord[];
  return records.sort((first, second) => {
    const firstDate = first.closed_purchase_date ?? first.finalizada_em ?? "";
    const secondDate = second.closed_purchase_date ?? second.finalizada_em ?? "";
    return secondDate.localeCompare(firstDate);
  });
}

export const updateShoppingHistoryPurchaseDate = async (
  listId: string,
  purchaseDate: string,
): Promise<void> => {
  const normalizedDate = purchaseDate.trim();
  if (!normalizedDate) {
    throw new Error("Data de compra inválida");
  }

  const { error } = await supabase
    .from("shopping_lists")
    .update({ closed_purchase_date: normalizedDate })
    .eq("id", listId)
    .eq("ativa", false);

  if (error) throw new Error(error.message);
};

export const deleteShoppingHistory = async (listId: string): Promise<void> => {
  const { error } = await supabase
    .from("shopping_lists")
    .delete()
    .eq("id", listId)
    .eq("ativa", false);

  if (error) throw new Error(error.message);
};

export async function createGroupForCurrentUser(groupName: string): Promise<{
  groupId: string;
  inviteCode: string;
  listId: string | null;
  groupName: string;
}> {
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();

  let group: { id: string; nome: string; codigo_convite: string } | null = null;

  const { data: groupId, error: rpcError } = await supabase.rpc("create_group", {
    group_name: groupName.trim(),
    invite_code: code,
  });

  if (!rpcError && groupId) {
    const { data: createdGroup, error: groupError } = await supabase
      .from("groups")
      .select("id, nome, codigo_convite")
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) throw new Error(groupError.message);
    if (!createdGroup) {
      throw new Error(
        "Grupo criado, mas não visível pelo usuário atual. Verifique policy SELECT em groups.",
      );
    }
    group = createdGroup;
  } else {
    // Fallback for projects that do not have the create_group RPC in schema cache.
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);

    const currentUserId = authData.user?.id;
    if (!currentUserId) throw new Error("Usuário não autenticado para criar grupo");

    const { data: insertedGroup, error: insertedGroupError } = await supabase
      .from("groups")
      .insert({ nome: groupName.trim(), codigo_convite: code })
      .select("id, nome, codigo_convite")
      .maybeSingle();

    if (insertedGroupError) throw new Error(insertedGroupError.message);
    if (!insertedGroup) {
      throw new Error("Não foi possível recuperar o grupo recém-criado");
    }

    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ group_id: insertedGroup.id, user_id: currentUserId });

    if (memberError) throw new Error(memberError.message);
    group = insertedGroup;
  }

  if (!group) throw new Error("Não foi possível criar o grupo");

  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .insert({ group_id: group.id, ativa: true, status: "active" })
    .select("id")
    .maybeSingle();

  if (listError) throw new Error(listError.message);
  if (!list) throw new Error("Não foi possível criar a lista inicial do grupo");

  return {
    groupId: group.id,
    inviteCode: code,
    listId: list.id,
    groupName: group.nome,
  };
}

export async function joinGroupByCode(
  inviteCode: string,
  userId: string,
): Promise<{
  groupId: string;
  groupName: string;
  inviteCode: string;
  listId: string | null;
}> {
  const normalizedCode = normalizeInviteCode(inviteCode);

  type JoinGroupRpcResult = {
    group_id: string;
    group_name: string;
    invite_code: string;
  };

  const isJoinGroupRpcResult = (value: unknown): value is JoinGroupRpcResult => {
    if (typeof value !== "object" || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj.group_id === "string" &&
      typeof obj.group_name === "string" &&
      typeof obj.invite_code === "string"
    );
  };

  const { data: rpcJoinData, error: rpcJoinError } = await supabase.rpc("join_group_by_code", {
    invite_code_input: normalizedCode,
  });

  if (!rpcJoinError && rpcJoinData) {
    const rawJoined: unknown = Array.isArray(rpcJoinData) ? rpcJoinData[0] : rpcJoinData;
    if (isJoinGroupRpcResult(rawJoined)) {
      const activeList = await ensureActiveListForGroup(rawJoined.group_id);

      return {
        groupId: rawJoined.group_id,
        groupName: rawJoined.group_name,
        inviteCode: rawJoined.invite_code,
        listId: activeList?.id ?? null,
      };
    }
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, nome, codigo_convite")
    .eq("codigo_convite", normalizedCode)
    .maybeSingle();

  if (groupError) throw new Error(groupError.message);
  if (!group) {
    throw new Error(
      "Grupo não encontrado para este código (ou sem permissão RLS para leitura por código de convite).",
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", group.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (!existing) {
    const { error: joinError } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId });

    if (joinError) throw new Error(joinError.message);
  }

  const activeList = await ensureActiveListForGroup(group.id);

  return {
    groupId: group.id,
    groupName: group.nome,
    inviteCode: group.codigo_convite,
    listId: activeList?.id ?? null,
  };
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Você não tem permissão para excluir este grupo ou ele não existe.");
  }
}

export async function createShoppingListForGroup(groupId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ group_id: groupId, ativa: true, status: "active" })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export type StockFrequency = "daily" | "weekly" | "monthly";

export interface ProductCatalogRecord {
  id: string;
  group_id: string;
  nome: string;
  categoria: string;
  unidade_estoque: string;
  ean: string | null;
}

export interface StockItemRecord {
  id: string;
  group_id: string;
  nome: string;
  categoria: string;
  unidade: Unit;
  quantidade: number;
  quantidade_minima: number;
  tamanho_porcao: number;
  na_lista: boolean;
  auto_adicionar_lista: boolean;
  consumo_frequencia: StockFrequency;
  consumo_valor: number;
  data_compra: string | null;
  data_validade: string | null;
  data_validade_alerta: string | null;
  validade_nao_aplica: boolean;
  ultimo_consumo_auto_em: string | null;
  criado_em: string;
  atualizado_em: string;
  pack_label: string | null;
  pack_size: number | null;
  product_id: string | null;
}

export interface StockMovementRecord {
  id: string;
  item_id: string;
  stock_item_id: string | null;
  lot_id: string | null;
  tipo: "entrada" | "saida" | "ajuste" | "consumo_auto" | "ajuste_validade_bulk";
  quantidade: number;
  unidade: string | null;
  custo_unitario_ref: number | null;
  observacao: string | null;
  origem: string | null;
  source_list_id: string | null;
  source_list_item_id: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface StockLotRecord {
  id: string;
  stock_item_id: string;
  source_list_item_id: string | null;
  quantidade_inicial: number;
  quantidade_restante: number;
  unidade: string;
  custo_total: number | null;
  custo_unitario: number | null;
  fator_consumo: number | null;
  data_compra: string;
  data_validade: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateStockLotInput {
  stockItemId: string;
  sourceListItemId?: string | null;
  quantidade: number;
  unidade: string;
  custoUnitario?: number | null;
  custoTotal?: number | null;
  dataCompra: string;
  dataValidade?: string | null;
  createdBy?: string | null;
}

export interface UpsertStockItemInput {
  id?: string;
  groupId: string;
  nome: string;
  categoria: string;
  unidade: Unit;
  quantidade: number;
  quantidadeMinima: number;
  tamanhoPorcao: number;
  autoAdicionarLista: boolean;
  consumoFrequencia: StockFrequency;
  consumoValor: number;
  dataCompra?: string | null;
  dataValidade?: string | null;
  packLabel?: string;
  packSize?: number;
}

export interface RecordStockMovementInput {
  itemId: string;
  tipo: "entrada" | "saida" | "ajuste" | "consumo_auto" | "ajuste_validade_bulk";
  quantidade: number;
  observacao?: string;
  createdBy?: string | null;
  lotId?: string | null;
  unidade?: string | null;
  custoUnitarioRef?: number | null;
  origem?: string | null;
  sourceListId?: string | null;
  sourceListItemId?: string | null;
}

export interface StockConsumptionSummary {
  averageDaily: number;
  averageWeekly: number;
  averageMonthly: number;
  runoutDays: number | null;
  consumedLast30Days: number;
}

const normalizeStockCategory = (categoria: string): string => {
  const trimmed = categoria.trim();
  return trimmed.length > 0 ? trimmed : "Outros";
};

const normalizeStockText = (value: string): string => {
  return value.trim().replace(/\s+/g, " ");
};

const toPositiveNumber = (value: number, fallback = 0): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
};

export const autoAddToShoppingList = async (
  groupId: string,
  itemName: string,
): Promise<boolean> => {
  const list = await ensureActiveListForGroup(groupId);
  const normalizedName = normalizeStockText(itemName);

  // Escape backslashes first, then ILIKE wildcards (% and _) to prevent wildcard injection in PostgreSQL.
  const escapedName = normalizedName
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data: existing, error: existingError } = await supabase
    .from("items")
    .select("id")
    .eq("list_id", list.id)
    .ilike("nome", escapedName)
    .limit(1);

  if (existingError) throw new Error(existingError.message);
  if (existing && existing.length > 0) return false;

  const { error: insertError } = await supabase.from("items").insert({
    list_id: list.id,
    nome: normalizedName,
    quantidade: "1 un",
    categoria: "Outros",
    comprado: false,
  });

  if (insertError) throw new Error(insertError.message);
  return true;
};

export const getDailyConsumption = (item: StockItemRecord): number => {
  const value = toPositiveNumber(item.consumo_valor);

  if (item.consumo_frequencia === "daily") return value;
  if (item.consumo_frequencia === "weekly") return value / 7;
  return value / 30;
};

export const runAutoConsumption = async (
  groupId: string,
  createdBy?: string | null,
): Promise<void> => {
  const items = await getStockItems(groupId);
  const now = new Date();

  for (const item of items) {
    const dailyConsumption = getDailyConsumption(item);
    if (dailyConsumption <= 0) continue;

    const lastDate = item.ultimo_consumo_auto_em ? new Date(item.ultimo_consumo_auto_em) : null;
    const lastTimestamp = lastDate?.getTime() ?? 0;
    const diffMs = Math.max(0, now.getTime() - lastTimestamp);
    const diffDays = lastTimestamp === 0 ? 1 : Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) continue;

    const amountToConsume = dailyConsumption * diffDays;
    if (amountToConsume <= 0) continue;

    await recordStockMovement({
      itemId: item.id,
      tipo: "consumo_auto",
      quantidade: amountToConsume,
      observacao: `Consumo automatico de ${diffDays} dia(s)`,
      createdBy,
    });

    const { error } = await supabase
      .from("stock_items")
      .update({ ultimo_consumo_auto_em: now.toISOString() })
      .eq("id", item.id);

    if (error) throw new Error(error.message);
  }
};

export const getStockItems = async (groupId: string): Promise<StockItemRecord[]> => {
  const { data, error } = await supabase
    .from("stock_items")
    .select(
      "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, tamanho_porcao, na_lista, auto_adicionar_lista, consumo_frequencia, consumo_valor, data_compra, data_validade, validade_nao_aplica, ultimo_consumo_auto_em, criado_em, atualizado_em, pack_label, pack_size, product_id",
    )
    .eq("group_id", groupId)
    .order("nome", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as StockItemRecord[];
};

export const getStockItemById = async (itemId: string): Promise<StockItemRecord | null> => {
  const { data, error } = await supabase
    .from("stock_items")
    .select(
      "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, tamanho_porcao, na_lista, auto_adicionar_lista, consumo_frequencia, consumo_valor, data_compra, data_validade, validade_nao_aplica, ultimo_consumo_auto_em, criado_em, atualizado_em, pack_label, pack_size, product_id",
    )
    .eq("id", itemId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as StockItemRecord | null) ?? null;
};

export const upsertStockItem = async (input: UpsertStockItemInput): Promise<StockItemRecord> => {
  const payload = {
    id: input.id,
    group_id: input.groupId,
    nome: normalizeStockText(input.nome),
    categoria: normalizeStockCategory(input.categoria),
    unidade: normalizeStockText(input.unidade),
    quantidade: toPositiveNumber(input.quantidade),
    quantidade_atual: toPositiveNumber(input.quantidade),
    quantidade_minima: toPositiveNumber(input.quantidadeMinima),
    tamanho_porcao: Math.max(1, toPositiveNumber(input.tamanhoPorcao, 1)),
    auto_adicionar_lista: input.autoAdicionarLista,
    consumo_frequencia: input.consumoFrequencia,
    consumo_valor: toPositiveNumber(input.consumoValor),
    data_compra: input.dataCompra ?? null,
    data_validade: input.dataValidade ?? null,
    pack_label: input.packLabel ?? null,
    pack_size: input.packSize ?? null,
  };

  const { data, error } = await supabase
    .from("stock_items")
    .upsert(payload)
    .select(
      "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, tamanho_porcao, na_lista, auto_adicionar_lista, consumo_frequencia, consumo_valor, data_compra, data_validade, validade_nao_aplica, ultimo_consumo_auto_em, criado_em, atualizado_em, pack_label, pack_size, product_id",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nao foi possivel salvar item de estoque");
  return data as StockItemRecord;
};

export const deleteStockItemById = async (itemId: string): Promise<void> => {
  const { error } = await supabase.from("stock_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
};

export const deleteStockItemsBulk = async (itemIds: string[]): Promise<void> => {
  if (itemIds.length === 0) return;
  const { error } = await supabase.from("stock_items").delete().in("id", itemIds);
  if (error) throw new Error(error.message);
};

export const getStockMovements = async (
  itemId: string,
  limit = 30,
): Promise<StockMovementRecord[]> => {
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, item_id, stock_item_id, lot_id, tipo, quantidade, unidade, custo_unitario_ref, observacao, origem, source_list_id, source_list_item_id, criado_por, criado_em",
    )
    .or(`item_id.eq.${itemId},stock_item_id.eq.${itemId}`)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as StockMovementRecord[];
};

export const getStockLotsByStockItem = async (stockItemId: string): Promise<StockLotRecord[]> => {
  try {
    const { data, error } = await supabase
      .from("stock_lots")
      .select(
        "id, stock_item_id, source_list_item_id, quantidade_inicial, quantidade_restante, unidade, custo_total, custo_unitario, fator_consumo, data_compra, data_validade, created_by, created_at",
      )
      .eq("stock_item_id", stockItemId)
      .order("data_compra", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as StockLotRecord[];
  } catch {
    // Compatibilidade com ambientes onde a migration V2 ainda não foi aplicada.
    return [];
  }
};
/**
 * Fetches all available stock lots for a specific item, sorted by purchase date.
 *
 * @param stockItemId - The item UUID
 */
/**
 * Creates a stock lot for a given stock item.
 * The trigger `trg_sync_stock_item_quantity` will automatically
 * recalculate `stock_items.quantidade` after insert.
 */
export const createStockLot = async (input: CreateStockLotInput): Promise<StockLotRecord> => {
  const { data, error } = await supabase
    .from("stock_lots")
    .insert({
      stock_item_id: input.stockItemId,
      source_list_item_id: input.sourceListItemId ?? null,
      quantidade_inicial: input.quantidade,
      quantidade_restante: input.quantidade,
      unidade: input.unidade,
      custo_unitario: input.custoUnitario ?? null,
      custo_total: input.custoTotal ?? null,
      data_compra: input.dataCompra,
      data_validade: input.dataValidade ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, stock_item_id, source_list_item_id, quantidade_inicial, quantidade_restante, unidade, custo_total, custo_unitario, fator_consumo, data_compra, data_validade, created_by, created_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Não foi possível criar o lote de estoque");
  return data as StockLotRecord;
};

/**
 * Toggles whether a stock item should be added to the shopping list.
 *
 * @param itemId - The stock item UUID
 * @param include - Whether it should be on the list
 */
export const setStockItemInShoppingList = async (
  itemId: string,
  include: boolean,
): Promise<StockItemRecord> => {
  const item = await getStockItemById(itemId);
  if (!item) throw new Error("Item de estoque nao encontrado");

  if (include) {
    await autoAddToShoppingList(item.group_id, item.nome);
  }

  const { data, error } = await supabase
    .from("stock_items")
    .update({ na_lista: include })
    .eq("id", itemId)
    .select(
      "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, tamanho_porcao, na_lista, auto_adicionar_lista, consumo_frequencia, consumo_valor, data_compra, data_validade, validade_nao_aplica, ultimo_consumo_auto_em, criado_em, atualizado_em, pack_label, pack_size, product_id",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nao foi possivel atualizar status do item na lista");
  return data as StockItemRecord;
};

export interface RecordStockMovementResult {
  autoAddedToList: boolean;
}

/**
 * Records a stock movement (in/out/adjustment) and updates item quantity.
 *
 * If it's a "saida" (exit) or "consumo_auto" (auto-consume), it uses FIFO logic
 * to consume from existing lots via RPC.
 *
 * @param input - The movement details
 */
export const recordStockMovement = async (
  input: RecordStockMovementInput,
): Promise<RecordStockMovementResult> => {
  const quantity = toPositiveNumber(input.quantidade);
  if (quantity <= 0) throw new Error("Quantidade deve ser maior que zero");

  const item = await getStockItemById(input.itemId);
  if (!item) throw new Error("Item de estoque nao encontrado");

  let nextQuantity: number;

  if (input.tipo === "saida" || input.tipo === "consumo_auto") {
    // Phase 3.4: Consumo FIFO
    const { error: rpcError } = await supabase.rpc("consume_stock_fifo", {
      p_stock_item_id: input.itemId,
      p_quantidade: quantity,
      p_tipo: input.tipo,
      p_observacao: input.observacao ?? null,
      p_origem: input.origem ?? null,
      p_criado_por: input.createdBy ?? null,
    });

    if (rpcError) {
      console.error("Falha ao consumir FIFO, fallback para logica padrao:", rpcError);
      throw new Error(rpcError.message);
    }

    nextQuantity = Math.max(0, item.quantidade - quantity);
  } else {
    // Entrada ou ajuste
    nextQuantity = input.tipo === "entrada" ? item.quantidade + quantity : Math.max(0, quantity);

    const { error: updateError } = await supabase
      .from("stock_items")
      .update({ quantidade: nextQuantity })
      .eq("id", input.itemId);

    if (updateError) throw new Error(updateError.message);

    const { error: movementError } = await supabase.from("stock_movements").insert({
      item_id: input.itemId,
      stock_item_id: input.itemId,
      lot_id: input.lotId ?? null,
      tipo: input.tipo,
      quantidade: quantity,
      unidade: input.unidade ?? null,
      custo_unitario_ref: input.custoUnitarioRef ?? null,
      observacao: input.observacao ?? null,
      origem: input.origem ?? null,
      source_list_id: input.sourceListId ?? null,
      source_list_item_id: input.sourceListItemId ?? null,
      criado_por: input.createdBy ?? null,
    });

    if (movementError) throw new Error(movementError.message);
  }

  let autoAddedToList = false;

  const reachedMinimum = nextQuantity <= item.quantidade_minima;
  if (input.tipo !== "entrada" && item.auto_adicionar_lista && reachedMinimum) {
    autoAddedToList = await autoAddToShoppingList(item.group_id, item.nome);

    const { error: updateListFlagError } = await supabase
      .from("stock_items")
      .update({ na_lista: true })
      .eq("id", input.itemId);

    if (updateListFlagError) throw new Error(updateListFlagError.message);
  }

  return { autoAddedToList };
};

export const getStockConsumptionSummary = async (
  itemId: string,
): Promise<StockConsumptionSummary> => {
  const item = await getStockItemById(itemId);
  if (!item) {
    return {
      averageDaily: 0,
      averageWeekly: 0,
      averageMonthly: 0,
      runoutDays: null,
      consumedLast30Days: 0,
    };
  }

  const date30DaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("stock_movements")
    .select("quantidade, tipo, criado_em")
    .eq("item_id", itemId)
    .in("tipo", ["saida", "consumo_auto"])
    .gte("criado_em", date30DaysAgo);

  if (error) throw new Error(error.message);

  const consumedLast30Days = (data ?? []).reduce((sum, movement) => sum + movement.quantidade, 0);
  const averageDaily = consumedLast30Days / 30;
  const averageWeekly = averageDaily * 7;
  const averageMonthly = averageDaily * 30;
  const runoutDays = averageDaily > 0 ? item.quantidade / averageDaily : null;

  return {
    averageDaily,
    averageWeekly,
    averageMonthly,
    runoutDays,
    consumedLast30Days,
  };
};
/**
 * Performs a bulk update of the expiration date or non-perishable flag across multiple stock items.
 * Uses a backend RPC to ensure all updates happen within a single transaction,
 * preventing race conditions and generating the appropriate 'ajuste_validade_bulk' stock movements.
 *
 * @param itemIds - An array of stock item UUIDs to update.
 * @param validityDate - The new expiration date (YYYY-MM-DD), or null if clearing/not applicable.
 * @param naoAplica - If true, marks the items as non-perishable (validade_nao_aplica = true) and updates the global product catalog. Defaults to false.
 */
export async function bulkUpdateStockValidity(
  itemIds: string[],
  validityDate: string | null,
  naoAplica: boolean = false,
): Promise<void> {
  const { error } = await supabase.rpc("rpc_bulk_update_stock_validity", {
    p_item_ids: itemIds,
    p_data_validade: validityDate,
    p_nao_aplica: naoAplica,
  });

  if (error) throw new Error(error.message);
}

/**
 * Re-enables expiration tracking for a single stock item that was previously marked as
 * "Não se aplica" (non-perishable). Also flips the catalog learning flag back to perishable
 * so future purchases of this product require a validity date again.
 *
 * This is the single-item "undo" complement to the bulk "Não se aplica" action.
 *
 * @param stockItemId - The UUID of the stock item to revert.
 */
export async function setStockItemPerishable(stockItemId: string): Promise<void> {
  const { data: stockItem, error: fetchError } = await supabase
    .from("stock_items")
    .select("product_id")
    .eq("id", stockItemId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const { error: updateError } = await supabase
    .from("stock_items")
    .update({ validade_nao_aplica: false })
    .eq("id", stockItemId);

  if (updateError) throw new Error(updateError.message);

  if (stockItem?.product_id) {
    const { error: catalogError } = await supabase
      .from("product_catalog")
      .update({ perecivel: true })
      .eq("id", stockItem.product_id);

    if (catalogError) throw new Error(catalogError.message);
  }
}

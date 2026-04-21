import { normalizeInviteCode } from "../domain/listRules";
import { pickActiveGroup, type GroupRecord } from "../domain/sessionRules";
import { supabase } from "./supabase";

export interface UserSessionData {
  id: string;
  name: string;
}

export interface ShoppingListRecord {
  id: string;
  ativa: boolean;
  finalizada_em: string | null;
  total: number | null;
  group_id: string;
  items?: Array<{ id: string }>;
}

export interface ItemRecord {
  id: string;
  nome: string;
  quantidade: string;
  categoria: string;
  comprado: boolean;
  preco: number | null;
  criado_por: string | null;
  list_id: string;
}

export interface MemberRecord {
  id: string;
  nome: string;
}

export async function getCurrentUser(): Promise<UserSessionData | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  return {
    id: user.id,
    name: user.user_metadata?.nome ?? user.email ?? "",
  };
}

export async function getSessionUser(): Promise<UserSessionData | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;

  return {
    id: user.id,
    name: user.user_metadata?.nome ?? user.email ?? "",
  };
}

export async function loadUserGroups(userId: string): Promise<GroupRecord[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("id, nome, codigo_convite, group_members!inner(user_id)")
    .eq("group_members.user_id", userId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((group) => ({
    id: group.id,
    nome: group.nome,
    codigo_convite: group.codigo_convite,
  }));
}

export async function restoreGroupContext(userId: string, savedGroupId: string | null) {
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
}

export async function loadMembers(groupId: string): Promise<MemberRecord[]> {
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
}

export async function loadActiveList(groupId: string): Promise<ShoppingListRecord | null> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("id, ativa, finalizada_em, total, group_id")
    .eq("group_id", groupId)
    .eq("ativa", true)
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function ensureActiveListForGroup(groupId: string): Promise<ShoppingListRecord> {
  const existing = await loadActiveList(groupId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ group_id: groupId, ativa: true })
    .select("id, ativa, finalizada_em, total, group_id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Não foi possível criar a lista ativa do grupo");
  }
  return data;
}

export async function loadListItems(listId: string): Promise<ItemRecord[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, nome, quantidade, categoria, comprado, preco, criado_por, list_id")
    .eq("list_id", listId)
    .order("criado_em", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface AddListItemInput {
  listId: string;
  nome: string;
  quantidade: string;
  categoria: string;
  price?: number | null;
  createdBy?: string | null;
}

export async function addListItem(input: AddListItemInput): Promise<void> {
  const { error } = await supabase.from("items").insert({
    list_id: input.listId,
    nome: input.nome,
    quantidade: input.quantidade,
    categoria: input.categoria,
    preco: input.price ?? null,
    comprado: false,
    criado_por: input.createdBy ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function toggleListItemPurchased(itemId: string, purchased: boolean): Promise<void> {
  const { error } = await supabase.from("items").update({ comprado: purchased }).eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function updateListItemPrice(itemId: string, price: number | null): Promise<void> {
  const { error } = await supabase.from("items").update({ preco: price }).eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function deleteListItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", itemId);

  if (error) throw new Error(error.message);
}

const parseListQuantityLabel = (rawQuantity: string): { quantidade: number; unidade: string } => {
  const normalized = rawQuantity.trim().replace(/\s+/g, " ");
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)(?:\s+([a-zA-Z]+))?$/);

  if (!match) {
    return { quantidade: 1, unidade: "un" };
  }

  const parsedQuantity = Number.parseFloat(match[1].replace(",", "."));
  const quantidade = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
  const unidade = (match[2] ?? "un").trim();

  return {
    quantidade,
    unidade: unidade.length > 0 ? unidade : "un",
  };
};

export async function finishShoppingList(listId: string, groupId: string): Promise<string | null> {
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("nome, quantidade, categoria, comprado, preco")
    .eq("list_id", listId);

  if (itemsError) throw new Error(itemsError.message);

  const total = (items ?? []).reduce((sum, item) => sum + (item.preco ?? 0), 0);

  const boughtItems = (items ?? []).filter((item) => item.comprado);
  const sourceItems = boughtItems.length > 0 ? boughtItems : (items ?? []);

  if (sourceItems.length > 0) {
    const currentStockItems = await getStockItems(groupId);
    const stockByKey = new Map(
      currentStockItems.map((stockItem) => [
        `${stockItem.nome.trim().toLowerCase()}::${stockItem.unidade.toLowerCase()}`,
        stockItem,
      ]),
    );
    const todayDate = new Date().toISOString().slice(0, 10);

    type AggregatedStockUpdate = {
      key: string;
      nome: string;
      categoria: string | null | undefined;
      unidade: string;
      quantidade: number;
    };
    const aggregatedStockUpdates = new Map<string, AggregatedStockUpdate>();

    for (const boughtItem of sourceItems) {
      const parsed = parseListQuantityLabel(boughtItem.quantidade);
      if (parsed.quantidade <= 0) continue;

      const key = `${boughtItem.nome.trim().toLowerCase()}::${parsed.unidade.toLowerCase()}`;
      const existingAggregatedUpdate = aggregatedStockUpdates.get(key);

      if (existingAggregatedUpdate) {
        existingAggregatedUpdate.quantidade += parsed.quantidade;
        continue;
      }

      aggregatedStockUpdates.set(key, {
        key,
        nome: boughtItem.nome,
        categoria: boughtItem.categoria,
        unidade: parsed.unidade,
        quantidade: parsed.quantidade,
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
          dataCompra: existingStockItem?.data_compra ?? todayDate,
          dataValidade: existingStockItem?.data_validade ?? null,
        });
      }),
    );

    for (const savedStockItem of savedStockItems) {
      const key = `${savedStockItem.nome.trim().toLowerCase()}::${savedStockItem.unidade.toLowerCase()}`;
      stockByKey.set(key, savedStockItem);
    }
  }

  const { error: updateError } = await supabase
    .from("shopping_lists")
    .update({
      ativa: false,
      finalizada_em: new Date().toISOString(),
      total: total > 0 ? total : null,
    })
    .eq("id", listId);

  if (updateError) throw new Error(updateError.message);

  const nextList = await ensureActiveListForGroup(groupId);
  return nextList.id;
}

export async function loadShoppingHistory(groupId: string): Promise<ShoppingListRecord[]> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("id, ativa, finalizada_em, total, group_id, items(*)")
    .eq("group_id", groupId)
    .eq("ativa", false)
    .order("finalizada_em", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

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
    .insert({ group_id: group.id, ativa: true })
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

export async function createShoppingListForGroup(groupId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ group_id: groupId, ativa: true })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export type StockFrequency = "daily" | "weekly" | "monthly";

export interface StockItemRecord {
  id: string;
  group_id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  quantidade_minima: number;
  tamanho_porcao: number;
  na_lista: boolean;
  auto_adicionar_lista: boolean;
  consumo_frequencia: StockFrequency;
  consumo_valor: number;
  data_compra: string | null;
  data_validade: string | null;
  ultimo_consumo_auto_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface StockMovementRecord {
  id: string;
  item_id: string;
  tipo: "entrada" | "saida" | "ajuste" | "consumo_auto";
  quantidade: number;
  observacao: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface UpsertStockItemInput {
  id?: string;
  groupId: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  quantidadeMinima: number;
  tamanhoPorcao: number;
  autoAdicionarLista: boolean;
  consumoFrequencia: StockFrequency;
  consumoValor: number;
  dataCompra?: string | null;
  dataValidade?: string | null;
}

export interface RecordStockMovementInput {
  itemId: string;
  tipo: "entrada" | "saida" | "ajuste" | "consumo_auto";
  quantidade: number;
  observacao?: string;
  createdBy?: string | null;
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
      "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, tamanho_porcao, na_lista, auto_adicionar_lista, consumo_frequencia, consumo_valor, data_compra, data_validade, ultimo_consumo_auto_em, criado_em, atualizado_em",
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
      "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, tamanho_porcao, na_lista, auto_adicionar_lista, consumo_frequencia, consumo_valor, data_compra, data_validade, ultimo_consumo_auto_em, criado_em, atualizado_em",
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
    quantidade_minima: toPositiveNumber(input.quantidadeMinima),
    tamanho_porcao: Math.max(1, toPositiveNumber(input.tamanhoPorcao, 1)),
    auto_adicionar_lista: input.autoAdicionarLista,
    consumo_frequencia: input.consumoFrequencia,
    consumo_valor: toPositiveNumber(input.consumoValor),
    data_compra: input.dataCompra ?? null,
    data_validade: input.dataValidade ?? null,
  };

  const { data, error } = await supabase
    .from("stock_items")
    .upsert(payload)
    .select(
      "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, tamanho_porcao, na_lista, auto_adicionar_lista, consumo_frequencia, consumo_valor, data_compra, data_validade, ultimo_consumo_auto_em, criado_em, atualizado_em",
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

export const getStockMovements = async (
  itemId: string,
  limit = 30,
): Promise<StockMovementRecord[]> => {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, item_id, tipo, quantidade, observacao, criado_por, criado_em")
    .eq("item_id", itemId)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as StockMovementRecord[];
};

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
      "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, tamanho_porcao, na_lista, auto_adicionar_lista, consumo_frequencia, consumo_valor, data_compra, data_validade, ultimo_consumo_auto_em, criado_em, atualizado_em",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nao foi possivel atualizar status do item na lista");
  return data as StockItemRecord;
};

export interface RecordStockMovementResult {
  autoAddedToList: boolean;
}

export const recordStockMovement = async (
  input: RecordStockMovementInput,
): Promise<RecordStockMovementResult> => {
  const quantity = toPositiveNumber(input.quantidade);
  if (quantity <= 0) throw new Error("Quantidade deve ser maior que zero");

  const item = await getStockItemById(input.itemId);
  if (!item) throw new Error("Item de estoque nao encontrado");

  const nextQuantity =
    input.tipo === "entrada"
      ? item.quantidade + quantity
      : input.tipo === "ajuste"
        ? Math.max(0, quantity)
        : Math.max(0, item.quantidade - quantity);

  const { error: updateError } = await supabase
    .from("stock_items")
    .update({ quantidade: nextQuantity })
    .eq("id", input.itemId);

  if (updateError) throw new Error(updateError.message);

  const { error: movementError } = await supabase.from("stock_movements").insert({
    item_id: input.itemId,
    tipo: input.tipo,
    quantidade: quantity,
    observacao: input.observacao ?? null,
    criado_por: input.createdBy ?? null,
  });

  if (movementError) throw new Error(movementError.message);

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

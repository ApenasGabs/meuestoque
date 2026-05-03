import { supabaseAdmin } from "../config/supabaseAdmin";

interface StockProductInput {
  nome: string;
  categoria?: string;
  unidade?: string;
  quantidade: number;
  quantidade_minima?: number;
  tamanho_porcao?: number;
  data_validade?: string | null;
}

interface StockLotInput {
  quantidade_inicial: number;
  unidade: string;
  data_compra: string;
  data_validade?: string | null;
  custo_total?: number | null;
}

interface StockMovementInput {
  tipo: "entrada" | "saida";
  quantidade: number;
  origem?: string;
  observacao?: string;
}

interface SeedStockResult {
  stockItemIds: string[];
}

/**
 * Creates stock items with associated product_catalog entries.
 *
 * @param groupId - Target group UUID
 * @param products - Array of product definitions
 * @returns Array of created stock_item IDs
 * @throws {Error} If creation fails
 */
export const seedStockWithProducts = async (
  groupId: string,
  products: StockProductInput[]
): Promise<SeedStockResult> => {
  const stockItemIds: string[] = [];

  for (const product of products) {
    const unidade = product.unidade ?? "un";

    // 1. Create product_catalog entry
    const { data: catalogData, error: catalogError } = await supabaseAdmin
      .from("product_catalog")
      .insert({
        group_id: groupId,
        nome: product.nome,
        categoria: product.categoria ?? "Outros",
        unidade_estoque: unidade,
        unidade_tipo: "simple",
        porcao_padrao: product.tamanho_porcao ?? 1,
        unidade_porcao: "un",
        consumo_tags: [],
      })
      .select("id")
      .single();

    if (catalogError) {
      throw new Error(
        `seedStockWithProducts (catalog ${product.nome}): ${catalogError.message}`
      );
    }

    // 2. Create stock_items entry
    const { data: stockData, error: stockError } = await supabaseAdmin
      .from("stock_items")
      .insert({
        group_id: groupId,
        product_id: catalogData.id,
        nome: product.nome,
        categoria: product.categoria ?? "Outros",
        unidade,
        quantidade: product.quantidade,
        quantidade_atual: product.quantidade,
        quantidade_minima: product.quantidade_minima ?? 0,
        tamanho_porcao: product.tamanho_porcao ?? 1,
        na_lista: false,
        auto_adicionar_lista: false,
        consumo_frequencia: "weekly",
        consumo_valor: 0,
        data_validade: product.data_validade ?? null,
      })
      .select("id")
      .single();

    if (stockError) {
      throw new Error(
        `seedStockWithProducts (stock ${product.nome}): ${stockError.message}`
      );
    }

    stockItemIds.push(stockData.id);
  }

  return { stockItemIds };
};

/**
 * Creates a stock item where quantity <= minimum quantity.
 * Useful for testing smart list generation and auto-add behavior.
 *
 * @param groupId - Target group UUID
 * @param product - Product at or below minimum
 * @returns Created stock_item ID
 */
export const seedStockAtMinimum = async (
  groupId: string,
  product: StockProductInput
): Promise<{ stockItemId: string }> => {
  const result = await seedStockWithProducts(groupId, [
    {
      ...product,
      quantidade_minima: Math.max(
        product.quantidade_minima ?? product.quantidade + 1,
        product.quantidade + 1
      ),
    },
  ]);

  return { stockItemId: result.stockItemIds[0] };
};

/**
 * Creates a stock item with associated lot records (for FIFO tracking).
 *
 * @param groupId - Target group UUID
 * @param product - Product definition
 * @param lots - Array of lot entries
 * @returns Stock item ID and lot IDs
 */
export const seedStockWithLots = async (
  groupId: string,
  product: StockProductInput,
  lots: StockLotInput[]
): Promise<{ stockItemId: string; lotIds: string[] }> => {
  const { stockItemIds } = await seedStockWithProducts(groupId, [product]);
  const stockItemId = stockItemIds[0];

  const lotsToInsert = lots.map((lot) => ({
    stock_item_id: stockItemId,
    quantidade_inicial: lot.quantidade_inicial,
    quantidade_restante: lot.quantidade_inicial,
    unidade: lot.unidade,
    data_compra: lot.data_compra,
    data_validade: lot.data_validade ?? null,
    custo_total: lot.custo_total ?? null,
  }));

  const { data, error } = await supabaseAdmin
    .from("stock_lots")
    .insert(lotsToInsert)
    .select("id");

  if (error) {
    throw new Error(`seedStockWithLots failed: ${error.message}`);
  }

  return {
    stockItemId,
    lotIds: (data ?? []).map((row) => row.id),
  };
};

/**
 * Creates a stock item with movement history records.
 *
 * @param groupId - Target group UUID
 * @param product - Product definition
 * @param movements - Array of movement entries
 * @returns Stock item ID
 */
export const seedStockWithMovements = async (
  groupId: string,
  product: StockProductInput,
  movements: StockMovementInput[]
): Promise<{ stockItemId: string }> => {
  const { stockItemIds } = await seedStockWithProducts(groupId, [product]);
  const stockItemId = stockItemIds[0];

  const movementsToInsert = movements.map((movement) => ({
    item_id: stockItemId,
    stock_item_id: stockItemId,
    tipo: movement.tipo,
    quantidade: movement.quantidade,
    unidade: product.unidade ?? "un",
    origem: movement.origem ?? "manual",
    observacao: movement.observacao ?? null,
  }));

  const { error } = await supabaseAdmin
    .from("stock_movements")
    .insert(movementsToInsert);

  if (error) {
    throw new Error(`seedStockWithMovements failed: ${error.message}`);
  }

  return { stockItemId };
};

/**
 * Creates a stock item near its expiry date for validity-related tests.
 *
 * @param groupId - Target group UUID
 * @param product - Product definition
 * @param expiryDate - ISO date string for the expiry
 * @returns Stock item ID
 */
export const seedStockNearExpiry = async (
  groupId: string,
  product: StockProductInput,
  expiryDate: string
): Promise<{ stockItemId: string }> => {
  const { stockItemIds } = await seedStockWithProducts(groupId, [
    { ...product, data_validade: expiryDate },
  ]);

  return { stockItemId: stockItemIds[0] };
};

/**
 * Cleans up all stock-related data for a group.
 *
 * @param groupId - Target group UUID
 */
export const cleanupGroupStock = async (groupId: string): Promise<void> => {
  // stock_movements and stock_lots cascade from stock_items FK
  const { error } = await supabaseAdmin
    .from("stock_items")
    .delete()
    .eq("group_id", groupId);

  if (error) {
    console.warn(`cleanupGroupStock warning: ${error.message}`);
  }

  // Also clean product_catalog
  await supabaseAdmin
    .from("product_catalog")
    .delete()
    .eq("group_id", groupId);
};

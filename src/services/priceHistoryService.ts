import { supabase } from "../lib/supabase";
import { extractProductParts } from "./brandDictionaryService";
import type { TendaBranchInfo, TendaItemQuote, TendaProduct } from "./tendaService";

export interface NfcePriceHistoryEntry {
  productName: string;
  baseProductHint?: string;
  unitPrice: number;
  quantity: number;
  unit: string;
}

export interface StorePriceRecord {
  id?: string;
  loja: string;
  filial_id: number;
  filial_nome?: string | null;
  produto_base: string;
  marca?: string | null;
  produto_nome: string;
  preco: number;
  preco_atacado?: number | null;
  qtd_atacado?: number | null;
  tamanho_valor?: number | null;
  tamanho_unidade?: string | null;
  url?: string | null;
  data_cotacao?: string;
  created_at?: string;
}

export interface PriceTrendSummary {
  currentPrice: number;
  previousPrice: number | null;
  percentageChange: number | null;
  direction: "down" | "up" | "stable" | "none";
  previousDate: string | null;
}

/**
 * Persiste em lote o histórico de cotações obtidas para uma filial.
 * A operação é idempotente para o mesmo dia e produto.
 *
 * @param quotes - Lista de cotações com produtos encontrados
 * @param branchInfo - Dados da filial consultada
 * @returns Promessa resolvida após persistência dos registros
 */
export const recordStorePriceHistory = async (
  quotes: TendaItemQuote[],
  branchInfo: TendaBranchInfo,
): Promise<void> => {
  if (!quotes || quotes.length === 0 || !branchInfo?.branchId) {
    return;
  }

  const recordsToInsert: StorePriceRecord[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const quote of quotes) {
    if (!quote.baseProduct) continue;

    const productsToPersist: TendaProduct[] = [];
    if (quote.recommended) {
      productsToPersist.push(quote.recommended);
    }
    if (quote.cheaperAlternativeOffer && quote.cheaperAlternativeOffer.id !== quote.recommended?.id) {
      productsToPersist.push(quote.cheaperAlternativeOffer);
    }

    if (quote.options && quote.options.length > 0) {
      for (const opt of quote.options) {
        if (!productsToPersist.some((p) => p.id === opt.id)) {
          productsToPersist.push(opt);
        }
      }
    }

    for (const product of productsToPersist) {
      const wholesale = product.wholesalePrices?.[0];
      recordsToInsert.push({
        loja: "tenda",
        filial_id: branchInfo.branchId,
        filial_nome: branchInfo.branchName,
        produto_base: quote.baseProduct,
        marca: product.brand || quote.requestedBrand || null,
        produto_nome: product.name,
        preco: product.price,
        preco_atacado: wholesale ? wholesale.price : null,
        qtd_atacado: wholesale ? wholesale.minQuantity : null,
        tamanho_valor: quote.targetSize ? quote.targetSize.value : null,
        tamanho_unidade: quote.targetSize ? quote.targetSize.unit : null,
        url: product.url,
        data_cotacao: today,
      });
    }
  }

  if (recordsToInsert.length === 0) {
    return;
  }

  try {
    const { error } = await supabase
      .from("store_price_history")
      .upsert(recordsToInsert, {
        onConflict: "loja,filial_id,produto_nome,data_cotacao",
        ignoreDuplicates: false,
      });

    if (error) {
      console.warn("[priceHistoryService] Falha ao persistir historico de precos:", error.message);
    }
  } catch (err: unknown) {
    console.warn("[priceHistoryService] Erro inesperado ao gravar historico:", err);
  }
};

/**
 * Persiste no histórico de preços por loja os itens importados de uma Nota Fiscal (NFC-e).
 *
 * @param entries - Itens da nota fiscal com preços unitários e quantidades
 * @param marketName - Nome do estabelecimento emissor da nota
 * @param purchaseDate - Data da compra no formato YYYY-MM-DD (opcional)
 * @returns Promessa resolvida após inserção dos dados de preço
 */
export const recordNfcePriceHistory = async (
  entries: NfcePriceHistoryEntry[],
  marketName: string,
  purchaseDate?: string,
): Promise<void> => {
  if (!entries || entries.length === 0) {
    return;
  }

  const effectiveDate = purchaseDate
    ? purchaseDate.slice(0, 10)
    : new Date().toISOString().split("T")[0];
  const storeSlug = (marketName || "nfce").trim().toLowerCase().slice(0, 80) || "nfce";

  const deduplicatedMap = new Map<string, StorePriceRecord>();

  for (const entry of entries) {
    if (!entry.productName || entry.unitPrice <= 0) continue;

    const parts = extractProductParts(entry.productName);
    const hintParts = entry.baseProductHint ? extractProductParts(entry.baseProductHint) : null;
    const baseProduct = (hintParts?.baseProduct || parts.baseProduct || entry.productName).trim();

    const recordKey = `${storeSlug}::0::${entry.productName.trim()}::${effectiveDate}`;
    deduplicatedMap.set(recordKey, {
      loja: storeSlug,
      filial_id: 0,
      filial_nome: marketName || "Nota Fiscal (NFC-e)",
      produto_base: baseProduct,
      marca: parts.brand || hintParts?.brand || null,
      produto_nome: entry.productName.trim(),
      preco: entry.unitPrice,
      tamanho_valor: entry.quantity > 0 ? entry.quantity : null,
      tamanho_unidade: entry.unit || null,
      data_cotacao: effectiveDate,
    });
  }

  const recordsToInsert = Array.from(deduplicatedMap.values());
  if (recordsToInsert.length === 0) {
    return;
  }

  try {
    const { error } = await supabase
      .from("store_price_history")
      .upsert(recordsToInsert, {
        onConflict: "loja,filial_id,produto_nome,data_cotacao",
        ignoreDuplicates: false,
      });

    if (error) {
      console.warn("[priceHistoryService] Falha ao persistir historico de NFC-e:", error.message);
    }
  } catch (err: unknown) {
    console.warn("[priceHistoryService] Erro inesperado ao gravar historico de NFC-e:", err);
  }
};

/**
 * Consulta o histórico recente de preços para um produto base específico.
 *
 * @param baseProduct - Nome canônico do produto
 * @param days - Quantidade máxima de dias retrospectivos (padrão: 30)
 * @returns Lista de registros de preços ordenados por data decrescente
 */
export const getPriceHistoryForBaseProduct = async (
  baseProduct: string,
  days: number = 30,
): Promise<StorePriceRecord[]> => {
  if (!baseProduct) return [];

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceDateStr = sinceDate.toISOString().split("T")[0];

  try {
    const { data, error } = await supabase
      .from("store_price_history")
      .select("*")
      .ilike("produto_base", baseProduct.trim())
      .gte("data_cotacao", sinceDateStr)
      .order("data_cotacao", { ascending: false });

    if (error) {
      console.warn("[priceHistoryService] Falha ao consultar historico:", error.message);
      return [];
    }

    return (data as StorePriceRecord[]) || [];
  } catch (err: unknown) {
    console.warn("[priceHistoryService] Erro na consulta de historico:", err);
    return [];
  }
};

/**
 * Calcula a tendência percentual de preço atual em relação ao histórico anterior.
 *
 * @param currentPrice - Preço atual cotado
 * @param history - Histórico prévio de preços
 * @param brand - Marca opcional para filtro estrito
 * @returns Resumo da tendência de preço
 */
export const calculatePriceTrend = (
  currentPrice: number,
  history: StorePriceRecord[],
  brand?: string | null,
): PriceTrendSummary => {
  const emptyTrend: PriceTrendSummary = {
    currentPrice,
    previousPrice: null,
    percentageChange: null,
    direction: "none",
    previousDate: null,
  };

  if (!currentPrice || !history || history.length === 0) {
    return emptyTrend;
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const relevantHistory = history.filter((rec) => {
    if (rec.data_cotacao === todayStr) return false;
    if (brand && rec.marca) {
      return rec.marca.toLowerCase() === brand.toLowerCase();
    }
    return true;
  });

  if (relevantHistory.length === 0) {
    return emptyTrend;
  }

  const previousRecord = relevantHistory[0];
  const previousPrice = Number(previousRecord.preco);

  if (!previousPrice || previousPrice <= 0) {
    return emptyTrend;
  }

  const diff = currentPrice - previousPrice;
  const percentageChange = Number(((diff / previousPrice) * 100).toFixed(1));

  let direction: "down" | "up" | "stable" | "none" = "stable";
  if (percentageChange < -1) {
    direction = "down";
  } else if (percentageChange > 1) {
    direction = "up";
  }

  return {
    currentPrice,
    previousPrice,
    percentageChange,
    direction,
    previousDate: previousRecord.data_cotacao || null,
  };
};


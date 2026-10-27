import type { InventoryProduct, InventoryShoppingListItem } from "../features/inventory/types";
import type { Unit } from "../types/inventory.types";
import { toUnit } from "../types/inventory.types";
import type { NfceItem } from "./nfceParser";

export interface MatchedReceiptItem {
  notaItem: NfceItem;
  listItem: InventoryShoppingListItem;
  product: InventoryProduct;
  confidence: number;
  selected: boolean;
  proposedPrice: number;
  proposedUnitPrice: number;
  proposedQuantity: number;
  proposedUnit: Unit;
  // Preservação estrita das regras de validade já cadastradas na lista
  preserveValidityDate: string | null;
  preserveNaoAplica: boolean;
}

export interface UnmatchedNotaItem {
  notaItem: NfceItem;
  selected: boolean;
  proposedPrice: number;
  proposedUnitPrice: number;
  proposedQuantity: number;
  proposedUnit: Unit;
}

export interface UnmatchedListItem {
  listItem: InventoryShoppingListItem;
  product: InventoryProduct;
}

export interface MatchReceiptResult {
  matches: MatchedReceiptItem[];
  unmatchedNota: UnmatchedNotaItem[];
  unmatchedList: UnmatchedListItem[];
}

/**
 * Tabela de expansão de abreviações comuns em notas fiscais brasileiras.
 */
const ABBREVIATIONS: Record<string, string> = {
  bov: "bovino",
  bovina: "bovino",
  suin: "suino",
  suina: "suino",
  frg: "frango",
  fgo: "frango",
  ling: "linguica",
  lingui: "linguica",
  tosc: "toscana",
  int: "integral",
  desn: "desnatado",
  desnat: "desnatado",
  semidesn: "semidesnatado",
  mol: "molho",
  ext: "extrato",
  tom: "tomate",
  choc: "chocolate",
  refri: "refrigerante",
  refrig: "refrigerante",
  sab: "sabao",
  amac: "amaciante",
  cond: "condicionador",
  shamp: "shampoo",
  bisc: "biscoito",
  bol: "bolacha",
  queij: "queijo",
  qjo: "queijo",
  mus: "mussarela",
  muss: "mussarela",
  pres: "presunto",
  pct: "pacote",
  cx: "caixa",
  cxa: "caixa",
  uht: "leite",
};

/**
 * Palavras irrelevantes que não agregam valor à comparação de produtos.
 */
const NOISE_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "sem",
  "para",
  "p/",
  "tipo",
  "leve",
  "mais",
  "pague",
  "menos",
  "promo",
  "un",
  "kg",
  "g",
  "ml",
  "l",
]);

/**
 * Remove acentos, pontuações e converte para minúsculas.
 */
export const normalizeText = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Converte o texto em tokens expandindo abreviações e filtrando ruídos.
 */
export const tokenizeText = (text: string): string[] => {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const rawTokens = normalized.split(/\s+/);
  const result: string[] = [];

  for (const token of rawTokens) {
    if (NOISE_WORDS.has(token)) continue;
    const expanded = ABBREVIATIONS[token] ?? token;
    result.push(expanded);
  }

  return result;
};

/**
 * Calcula a similaridade entre duas listas de tokens.
 * Retorna score de 0.0 a 1.0.
 */
export const calculateTokenSimilarity = (tokensA: string[], tokensB: string[]): number => {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let commonCount = 0;
  for (const tokenA of setA) {
    if (setB.has(tokenA)) {
      commonCount++;
    } else {
      // Verifica correspondência parcial (ex: "linguica" vs "linguicas")
      for (const tokenB of setB) {
        if (
          (tokenA.length >= 4 && tokenB.startsWith(tokenA)) ||
          (tokenB.length >= 4 && tokenA.startsWith(tokenB))
        ) {
          commonCount += 0.85;
          break;
        }
      }
    }
  }

  // Se todos os tokens da lista (geralmente menor) estão na nota, bônus alto
  const coverageA = commonCount / setA.size;
  const coverageB = commonCount / setB.size;

  return Math.min(1, Math.max(coverageA * 0.7 + coverageB * 0.3, coverageA));
};

/**
 * Mapeia a unidade da nota fiscal para a unidade suportada pelo sistema.
 */
export const mapNotaUnitToSystemUnit = (notaUnidade: string): Unit => {
  const clean = notaUnidade.trim().toUpperCase();
  if (clean === "KG") return "Kg";
  if (clean === "G" || clean === "GR") return "g";
  if (clean === "L" || clean === "LT") return "L";
  if (clean === "ML") return "mL";
  if (clean === "CX") return "cx";
  if (clean === "PCT") return "pct";
  return toUnit(notaUnidade);
};

interface CandidatePair {
  notaIndex: number;
  listIndex: number;
  score: number;
}

/**
 * Realiza o match entre os itens da NFC-e e a lista de compras atual.
 */
export const matchReceiptWithShoppingList = (
  notaItens: NfceItem[],
  listaItens: InventoryShoppingListItem[],
  produtos: InventoryProduct[],
): MatchReceiptResult => {
  const productMap = new Map<string, InventoryProduct>();
  for (const p of produtos) {
    productMap.set(p.id, p);
  }

  // Pré-tokeniza os itens da lista
  const listItemsMeta = listaItens.map((item) => {
    const product = productMap.get(item.productId);
    const productName = product ? product.name : "";
    const tokens = tokenizeText(productName);
    return { item, product, productName, tokens };
  });

  // Pré-tokeniza os itens da nota
  const notaItemsMeta = notaItens.map((notaItem) => ({
    notaItem,
    tokens: tokenizeText(notaItem.descricao),
  }));

  const candidates: CandidatePair[] = [];

  for (let nIdx = 0; nIdx < notaItemsMeta.length; nIdx++) {
    const nMeta = notaItemsMeta[nIdx];
    for (let lIdx = 0; lIdx < listItemsMeta.length; lIdx++) {
      const lMeta = listItemsMeta[lIdx];
      const score = calculateTokenSimilarity(lMeta.tokens, nMeta.tokens);

      if (score >= 0.4) {
        candidates.push({ notaIndex: nIdx, listIndex: lIdx, score });
      }
    }
  }

  // Ordena por score decrescente para atribuição gulosa 1-para-1
  candidates.sort((a, b) => b.score - a.score);

  const matchedNotaIndexes = new Set<number>();
  const matchedListIndexes = new Set<number>();
  const matches: MatchedReceiptItem[] = [];

  for (const cand of candidates) {
    if (matchedNotaIndexes.has(cand.notaIndex) || matchedListIndexes.has(cand.listIndex)) {
      continue;
    }

    matchedNotaIndexes.add(cand.notaIndex);
    matchedListIndexes.add(cand.listIndex);

    const nMeta = notaItemsMeta[cand.notaIndex];
    const lMeta = listItemsMeta[cand.listIndex];

    const product =
      lMeta.product ??
      ({
        id: lMeta.item.productId,
        name: nMeta.notaItem.descricao,
        quantity: 0,
        minStock: 0,
        categoryId: "",
      } as InventoryProduct);

    const proposedUnit = mapNotaUnitToSystemUnit(nMeta.notaItem.unidade);

    matches.push({
      notaItem: nMeta.notaItem,
      listItem: lMeta.item,
      product,
      confidence: cand.score,
      selected: true,
      proposedPrice: nMeta.notaItem.valorTotal,
      proposedUnitPrice: nMeta.notaItem.valorUnitario,
      proposedQuantity: nMeta.notaItem.quantidade,
      proposedUnit,
      // Preservação absoluta das validades já existentes no item da lista
      preserveValidityDate: lMeta.item.validityDate ?? null,
      preserveNaoAplica: Boolean(lMeta.item.naoAplicaValidade),
    });
  }

  // Itens da nota que não casaram com nenhum item da lista
  const unmatchedNota: UnmatchedNotaItem[] = [];
  for (let nIdx = 0; nIdx < notaItemsMeta.length; nIdx++) {
    if (!matchedNotaIndexes.has(nIdx)) {
      const nItem = notaItemsMeta[nIdx].notaItem;
      unmatchedNota.push({
        notaItem: nItem,
        selected: true, // Conforme decisão: itens na nota mas fora da lista entram selecionados
        proposedPrice: nItem.valorTotal,
        proposedUnitPrice: nItem.valorUnitario,
        proposedQuantity: nItem.quantidade,
        proposedUnit: mapNotaUnitToSystemUnit(nItem.unidade),
      });
    }
  }

  // Itens da lista que não estavam na nota
  const unmatchedList: UnmatchedListItem[] = [];
  for (let lIdx = 0; lIdx < listItemsMeta.length; lIdx++) {
    if (!matchedListIndexes.has(lIdx)) {
      const lMeta = listItemsMeta[lIdx];
      const product =
        lMeta.product ??
        ({
          id: lMeta.item.productId,
          name: "Item da lista",
          quantity: 0,
          minStock: 0,
          categoryId: "",
        } as InventoryProduct);

      unmatchedList.push({
        listItem: lMeta.item,
        product,
      });
    }
  }

  return {
    matches,
    unmatchedNota,
    unmatchedList,
  };
};

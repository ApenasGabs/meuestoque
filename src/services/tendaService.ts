import { extractProductParts, recordDiscoveredBrand } from "./brandDictionaryService";

export interface ProductSize {
  value: number;
  unit: "kg" | "g" | "l" | "ml";
}

export interface TendaWholesalePrice {
  minQuantity: number;
  price: number;
}

export interface TendaProduct {
  id: number;
  name: string;
  brand: string;
  price: number;
  wholesalePrices: TendaWholesalePrice[] | null;
  url: string;
  thumbnail: string | null;
  inStock: boolean;
}

export interface TendaBranchInfo {
  branchId: number;
  branchName: string;
  deliveryPrice: number;
  deliveryDays: number;
  address: string;
  available: boolean;
}

export interface TendaItemQuote {
  itemName: string;
  baseProduct: string;
  requestedBrand: string | null;
  targetSize: ProductSize | null;
  startingFromPrice: number | null;
  recommended: TendaProduct | null;
  sameBrandOffer: TendaProduct | null;
  cheaperAlternativeOffer: TendaProduct | null;
  options: TendaProduct[];
  totalFound: number;
  error?: string | null;
}

interface RawTendaProduct {
  id: number;
  name: string;
  brand: string;
  price: number;
  wholesalePrices: TendaWholesalePrice[] | null;
  url: string;
  thumbnail?: string;
  totalStock?: number;
}

interface RawShippingResponse {
  addressInfo?: {
    addressLine1?: string;
    district?: string;
    city?: string;
    state?: string;
  };
  delivery?: {
    available?: boolean;
    price?: number;
    expectedDeliveryDays?: number;
    branch?: {
      id?: number;
      name?: string;
    };
  };
}

const DEFAULT_BASE_API = "/api/tenda";

const safeFetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro na consulta (HTTP ${response.status})`);
  }

  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType && !contentType.includes("application/json")) {
    throw new Error(
      "A API retornou uma resposta inválida (HTML em vez de JSON). Se você estiver em desenvolvimento, certifique-se de reiniciar o servidor Vite (`npm run dev`) para que a regra de proxy seja ativada.",
    );
  }

  return (await response.json()) as T;
};

export interface CachedTendaPayload<T> {
  data: T;
  expiresAt: number;
}

/**
 * Retorna o timestamp em milissegundos das 23:59:59.999 do dia atual.
 * Garante que qualquer dado em cache expire rigorosamente na virada para o dia seguinte.
 */
export const getTodayMidnightTimestamp = (): number => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return midnight.getTime();
};

const CACHE_PREFIX = "tenda_cache_";

/**
 * Obtém dados armazenados em cache se ainda forem válidos para o dia de hoje.
 * Caso o dado tenha expirado (ou seja do dia anterior), é removido automaticamente.
 */
export const getCachedTendaData = <T>(key: string): T | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedTendaPayload<T>;
    if (!parsed || typeof parsed.expiresAt !== "number") return null;

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};

/**
 * Salva dados no cache local com expiração definida para as 23:59:59 de hoje.
 */
export const setCachedTendaData = <T>(key: string, data: T): void => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const payload: CachedTendaPayload<T> = {
      data,
      expiresAt: getTodayMidnightTimestamp(),
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    // Falha silenciosa em caso de cota de localStorage excedida
  }
};

/**
 * Limpa todos os dados armazenados em cache do Tenda.
 */
export const clearTendaCache = (): void => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // Ignora erros
  }
};

/**
 * Extrai a medida e unidade (ex: 5kg, 500ml, 1L) a partir do texto do produto.
 *
 * @param text - Nome ou descrição do produto
 * @returns Objeto com valor e unidade normalizados ou nulo se não houver
 */
export const extractProductSize = (text: string): ProductSize | null => {
  const normalized = text.toLowerCase().replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const rawUnit = match[2];
  const unit = rawUnit === "l" ? "l" : (rawUnit as "kg" | "g" | "ml");

  return { value, unit };
};

/**
 * Verifica se o nome do produto atende ao tamanho/peso desejado pelo usuário.
 *
 * @param productName - Nome do produto retornado pelo Tenda
 * @param targetSize - Tamanho desejado do produto
 * @returns Verdadeiro se o tamanho for compatível ou se nenhum tamanho foi exigido
 */
export const matchesProductSize = (
  productName: string,
  targetSize: ProductSize | null,
): boolean => {
  if (!targetSize) return true;
  const prodSize = extractProductSize(productName);
  if (!prodSize) return false;

  return prodSize.unit === targetSize.unit && Math.abs(prodSize.value - targetSize.value) < 0.05;
};

/**
 * Normaliza o termo de busca removendo caracteres especiais e espaços extras.
 *
 * @param name - Nome original do item da lista
 * @returns Termo sanitizado para envio à API
 */
export const sanitizeItemSearchQuery = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\btaiti\b/g, "tahiti")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|l|ml)\b/g, " ")
    .replace(/\btipo\s*\d+\b/g, " ")
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const STOP_WORDS = new Set([
  "de",
  "do",
  "da",
  "dos",
  "das",
  "com",
  "em",
  "para",
  "tipo",
  "1",
  "2",
  "3",
  "pct",
  "un",
  "unidade",
  "kg",
  "g",
  "l",
  "ml",
]);

const DERIVATIVE_WORDS = new Set([
  "detergente",
  "desengordurante",
  "amaciante",
  "desinfetante",
  "sabao",
  "refrigerante",
  "suco",
  "refresco",
  "cha",
  "biscoito",
  "gelatina",
  "sorvete",
  "bala",
  "wafer",
  "isotonico",
  "aromatizador",
  "vela",
  "shampoo",
  "maionese",
  "amido",
  "molho",
  "lasanha",
  "alho",
  "goiaba",
]);

const SUBTYPE_KEYWORDS = [
  "preto",
  "carioca",
  "branco",
  "integral",
  "parboilizado",
  "tahiti",
  "siciliano",
  "extra",
  "virgem",
  "desnatado",
  "semidesnatado",
];

const normalizeText = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\btaiti\b/g, "tahiti")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Extrai os tokens centrais de um item ignorando pesos, medidas e stop words.
 *
 * @param name - Nome original do produto
 * @returns Lista de palavras-chave canônicas
 */
export const extractCoreTokens = (name: string): string[] => {
  const sanitized = sanitizeItemSearchQuery(name);
  const normalized = normalizeText(sanitized);
  return normalized.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));
};

/**
 * Valida se um produto do catálogo do Tenda é semanticamente relevante para o item solicitado.
 * Previne que "Arroz" seja sugerido para "Feijão", ou que "Goiaba" / "Detergente Limão" seja sugerido para "Limão Taiti".
 *
 * @param candidateName - Nome do produto retornado pelo Tenda
 * @param requestedName - Nome do item na lista do usuário
 * @returns Verdadeiro se o produto for realmente do mesmo tipo
 */
export const isProductSemanticallyRelevant = (
  candidateName: string,
  requestedName: string,
): boolean => {
  const reqTokens = extractCoreTokens(requestedName);
  if (reqTokens.length === 0) return true;

  const candNorm = normalizeText(candidateName);
  const candTokens = candNorm.split(" ");
  const primaryNoun = reqTokens[0]; // ex: "limao", "feijao", "arroz"

  // O produto candidato PRECISA conter o substantivo principal do item solicitado
  if (!candNorm.includes(primaryNoun)) {
    return false;
  }

  // Se o item solicitado não for um produto derivado (ex: detergente, biscoito, refrigerante),
  // o candidato não pode ser um produto derivado aromatizado com o ingrediente
  const reqHasDerivative = reqTokens.some((t) => DERIVATIVE_WORDS.has(t));
  if (!reqHasDerivative) {
    for (const deriv of DERIVATIVE_WORDS) {
      if (candTokens.includes(deriv) && !reqTokens.includes(deriv)) {
        return false;
      }
    }
  }

  // Subtipos específicos (ex: feijão preto vs carioca, limão tahiti vs siciliano)
  const subtypes = reqTokens.slice(1).filter((t) => SUBTYPE_KEYWORDS.includes(t));
  for (const sub of subtypes) {
    if (!candNorm.includes(sub)) {
      return false;
    }
  }

  return true;
};

/**
 * Consulta a filial e informações de entrega do Tenda Atacado para o CEP informado.
 *
 * @param cep - Código postal (com ou sem pontuação)
 * @param baseUrl - Prefixo de API (opcional, default /api/tenda)
 * @returns Informações da filial e entrega
 */
export const resolveTendaBranchByCep = async (
  cep: string,
  baseUrl: string = DEFAULT_BASE_API,
  bypassCache = false,
): Promise<TendaBranchInfo> => {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) {
    throw new Error("CEP inválido. Deve conter 8 dígitos.");
  }

  const cacheKey = `branch_${cleanCep}`;
  if (!bypassCache) {
    const cached = getCachedTendaData<TendaBranchInfo>(cacheKey);
    if (cached) return cached;
  }

  const data = await safeFetchJson<RawShippingResponse>(
    `${baseUrl}/public/store/shipping-options/${cleanCep}`,
  );
  const delivery = data.delivery;
  const branch = delivery?.branch;

  if (!branch?.id || !branch.name) {
    throw new Error("Nenhuma loja do Tenda Atacado atende a este CEP para entrega.");
  }

  const address = [
    data.addressInfo?.addressLine1,
    data.addressInfo?.district,
    data.addressInfo?.city,
    data.addressInfo?.state,
  ]
    .filter(Boolean)
    .join(", ");

  const branchInfo: TendaBranchInfo = {
    branchId: branch.id,
    branchName: branch.name,
    deliveryPrice: delivery?.price ?? 0,
    deliveryDays: delivery?.expectedDeliveryDays ?? 0,
    address: address || "Endereço não identificado",
    available: Boolean(delivery?.available),
  };

  setCachedTendaData(cacheKey, branchInfo);
  return branchInfo;
};

/**
 * Busca produtos no catálogo do Tenda Atacado para a filial informada.
 *
 * @param query - Termo de busca
 * @param branchId - Identificador numérico da filial
 * @param baseUrl - Prefixo da API
 * @returns Lista de produtos disponíveis com preços
 */
export const searchTendaProducts = async (
  query: string,
  branchId: number,
  baseUrl: string = DEFAULT_BASE_API,
): Promise<TendaProduct[]> => {
  const sanitized = sanitizeItemSearchQuery(query);
  if (!sanitized) return [];

  const url = `${baseUrl}/public/store/search?query=${encodeURIComponent(sanitized)}&branchId=${branchId}`;
  try {
    const data = await safeFetchJson<{ products?: RawTendaProduct[] }>(url);
    const rawProducts = data.products || [];

    return rawProducts
      .filter((p) => Number.isFinite(p.price) && p.price > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        price: p.price,
        wholesalePrices: p.wholesalePrices,
        url: p.url,
        thumbnail: p.thumbnail || null,
        inStock: (p.totalStock ?? 1) > 0,
      }));
  } catch {
    return [];
  }
};

/**
 * Realiza a cotação inteligente de um item da lista de compras no Tenda Atacado.
 * Extrai o tamanho pretendido, busca os produtos, filtra por compatibilidade de medida e ordena pelos mais baratos.
 *
 * @param itemName - Nome do item cadastrado na lista
 * @param branchId - Filial do Tenda Atacado
 * @param baseUrl - Prefixo da API
 * @returns Cotação detalhada com melhor oferta e opções alternativas
 */
export const quoteShoppingItemOnTenda = async (
  itemName: string,
  branchId: number,
  baseUrl: string = DEFAULT_BASE_API,
  bypassCache = false,
): Promise<TendaItemQuote> => {
  const parts = extractProductParts(itemName);
  const { baseProduct, brand: requestedBrand, size: targetSize } = parts;

  const sanitized = sanitizeItemSearchQuery(itemName).toLowerCase();
  const cacheKey = `quote_${branchId}_${sanitized}`;

  if (!bypassCache) {
    const cached = getCachedTendaData<TendaItemQuote>(cacheKey);
    if (cached) return cached;
  }

  const emptyQuote: TendaItemQuote = {
    itemName,
    baseProduct,
    requestedBrand,
    targetSize,
    startingFromPrice: null,
    recommended: null,
    sameBrandOffer: null,
    cheaperAlternativeOffer: null,
    options: [],
    totalFound: 0,
  };

  try {
    // Busca inicial pelo produto base (evita viés de pesquisa apenas por marca limitando o Tenda)
    let products = await searchTendaProducts(baseProduct, branchId, baseUrl);

    // Fallback se não encontrar pelo base: tenta pelo nome original
    if (products.length === 0 && baseProduct !== itemName) {
      products = await searchTendaProducts(itemName, branchId, baseUrl);
    }

    if (products.length === 0) {
      const coreTokens = extractCoreTokens(itemName);
      if (coreTokens.length > 1) {
        const fallbackTerm = coreTokens.slice(0, 2).join(" ");
        products = await searchTendaProducts(fallbackTerm, branchId, baseUrl);
      }
    }

    if (products.length === 0) {
      setCachedTendaData(cacheKey, emptyQuote);
      return emptyQuote;
    }

    // Registra marcas descobertas no background
    products.forEach((p) => {
      if (p.brand) {
        recordDiscoveredBrand(p.brand).catch(() => {});
      }
    });

    // Filtra apenas produtos semanticamente relevantes
    const relevantProducts = products.filter((p) =>
      isProductSemanticallyRelevant(p.name, itemName),
    );

    if (relevantProducts.length === 0) {
      setCachedTendaData(cacheKey, emptyQuote);
      return emptyQuote;
    }

    // Se houver produtos com tamanho/peso compatível, prioriza-os estritamente
    const matchingSize = relevantProducts.filter((p) => matchesProductSize(p.name, targetSize));
    const finalCandidates = matchingSize.length > 0 ? matchingSize : relevantProducts;

    const sortedByPrice = [...finalCandidates].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0] || null;

    let sameBrandOffer: TendaProduct | null = null;
    let cheaperAlternativeOffer: TendaProduct | null = null;

    if (requestedBrand) {
      const requestedBrandLower = requestedBrand.toLowerCase();
      sameBrandOffer =
        sortedByPrice.find(
          (p) =>
            (p.brand && p.brand.toLowerCase() === requestedBrandLower) ||
            p.name.toLowerCase().includes(requestedBrandLower),
        ) || null;

      if (
        sameBrandOffer &&
        cheapest &&
        cheapest.id !== sameBrandOffer.id &&
        cheapest.price < sameBrandOffer.price
      ) {
        cheaperAlternativeOffer = cheapest;
      } else if (!sameBrandOffer) {
        // Se pediu marca e não achou, a sugestão mais barata continua valendo
        cheaperAlternativeOffer = cheapest;
      }
    }

    const quote: TendaItemQuote = {
      itemName,
      baseProduct,
      requestedBrand,
      targetSize,
      startingFromPrice: cheapest ? cheapest.price : null,
      recommended: sameBrandOffer || cheapest,
      sameBrandOffer,
      cheaperAlternativeOffer,
      options: sortedByPrice.slice(0, 5),
      totalFound: relevantProducts.length,
    };

    setCachedTendaData(cacheKey, quote);
    return quote;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha ao cotar produto";
    return {
      ...emptyQuote,
      error: message,
    };
  }
};

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
  targetSize: ProductSize | null;
  startingFromPrice: number | null;
  recommended: TendaProduct | null;
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.,-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
): Promise<TendaBranchInfo> => {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) {
    throw new Error("CEP inválido. Deve conter 8 dígitos.");
  }

  const response = await fetch(`${baseUrl}/public/store/shipping-options/${cleanCep}`);
  if (!response.ok) {
    throw new Error(`Não foi possível consultar a filial do Tenda (status ${response.status})`);
  }

  const data: RawShippingResponse = await response.json();
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

  return {
    branchId: branch.id,
    branchName: branch.name,
    deliveryPrice: delivery?.price ?? 0,
    deliveryDays: delivery?.expectedDeliveryDays ?? 0,
    address: address || "Endereço não identificado",
    available: Boolean(delivery?.available),
  };
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
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }

  const data: { products?: RawTendaProduct[] } = await response.json();
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
): Promise<TendaItemQuote> => {
  const targetSize = extractProductSize(itemName);

  try {
    const products = await searchTendaProducts(itemName, branchId, baseUrl);

    if (products.length === 0) {
      return {
        itemName,
        targetSize,
        startingFromPrice: null,
        recommended: null,
        options: [],
        totalFound: 0,
      };
    }

    const matchingSize = products.filter((p) => matchesProductSize(p.name, targetSize));
    const candidateList = matchingSize.length > 0 ? matchingSize : products;

    const sortedByPrice = [...candidateList].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0] || null;

    return {
      itemName,
      targetSize,
      startingFromPrice: cheapest ? cheapest.price : null,
      recommended: cheapest,
      options: sortedByPrice.slice(0, 5),
      totalFound: candidateList.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha ao cotar produto";
    return {
      itemName,
      targetSize,
      startingFromPrice: null,
      recommended: null,
      options: [],
      totalFound: 0,
      error: message,
    };
  }
};

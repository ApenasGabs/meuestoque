import { type StockImportSource } from "./stockImportParser";

export interface ParsedShoppingImportItem {
  nome: string;
  categoria: string;
  quantidade: string;
  preco: number | null;
}

interface ParseShoppingImportOptions {
  source?: StockImportSource;
}

const CATEGORY_ALIAS: Record<string, string> = {
  mercearia: "Grãos",
  hortifruti: "Hortifruti",
  hortifrúti: "Hortifruti",
  "carnes, aves e peixes": "Carnes",
  "higiene e perfumaria": "Outros",
  limpeza: "Limpeza",
  "frios e laticinios": "Laticínios",
  "frios e laticínios": "Laticínios",
  "paes e bolos": "Outros",
  "pães e bolos": "Outros",
  "marca propria": "Outros",
  "marca própria": "Outros",
};

const normalizeText = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

const cleanLine = (value: string): string => value.replace(/\s+/g, " ").trim();

const parseLocaleNumber = (raw: string): number => {
  const value = raw.trim().replace(/\s+/g, "");

  if (!value) return 0;

  if (value.includes(",") && value.includes(".")) {
    return Number.parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
  }

  if (value.includes(",")) {
    return Number.parseFloat(value.replace(",", ".")) || 0;
  }

  return Number.parseFloat(value) || 0;
};

const formatQuantityNumber = (value: number): string => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
};

const isStoreHeaderLine = (line: string): boolean => {
  const normalized = normalizeText(line);
  if (!normalized) return true;
  if (normalized.startsWith("super mercado")) return true;
  if (normalized.startsWith("tenda super mercado")) return true;
  if (normalized.startsWith("item\tquantidade")) return true;
  return normalized === "item quantidade valor unitario valor total";
};

const extractCategory = (line: string): string | null => {
  const normalized = normalizeText(line);
  return CATEGORY_ALIAS[normalized] ?? null;
};

const isQuantityLabel = (line: string): boolean => {
  return /^(\d+(?:[.,]\d+)?)\s+(?:item|itens)$/i.test(line.trim());
};

const parseQuantityLabel = (line: string): number => {
  const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s+(?:item|itens)$/i);
  if (!match) return 0;
  return parseLocaleNumber(match[1]);
};

const parseTotalLine = (line: string): number | null => {
  const match = line.trim().match(/^Total:\s*R\$\s*([\d.,]+)$/i);
  if (!match) return null;
  return parseLocaleNumber(match[1]);
};

const parseInlineTendaLine = (line: string): ParsedShoppingImportItem | null => {
  const match = line
    .trim()
    .match(
      /^(.*?)\s+R\$\s*[\d.,]+\s+(\d+(?:[.,]\d+)?)\s+(?:item|itens)\s+Total:\s*R\$\s*([\d.,]+)$/i,
    );

  if (!match) return null;

  const nome = cleanLine(match[1]);
  const quantidade = `${formatQuantityNumber(parseLocaleNumber(match[2]))} un`;
  const preco = parseLocaleNumber(match[3]);

  return {
    nome,
    categoria: "Outros",
    quantidade,
    preco,
  };
};

const parsePagueMenosQuantityAndPrice = (
  line: string,
): { quantidade: number; total: number } | null => {
  const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s+R\$\s*[\d.,]+\s+R\$\s*([\d.,]+)$/i);
  if (!match) return null;

  return {
    quantidade: parseLocaleNumber(match[1]),
    total: parseLocaleNumber(match[2]),
  };
};

const hasExplicitPackageAmount = (name: string): boolean => {
  return /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i.test(name);
};

const buildQuantityLabel = (name: string, rawQuantity: number): string => {
  const normalizedName = normalizeText(name);

  if (hasExplicitPackageAmount(name)) {
    return `${formatQuantityNumber(rawQuantity)} un`;
  }

  if (/\bkg\b/.test(normalizedName) && rawQuantity >= 1000) {
    return `${formatQuantityNumber(rawQuantity / 1000)} kg`;
  }

  if (/\bl\b/.test(normalizedName) && rawQuantity >= 1000) {
    return `${formatQuantityNumber(rawQuantity / 1000)} L`;
  }

  return `${formatQuantityNumber(rawQuantity)} un`;
};

const isLikelyProductLine = (line: string): boolean => {
  const cleaned = line.trim();
  if (cleaned.length < 3) return false;
  if (isStoreHeaderLine(cleaned)) return false;
  if (/^R\$/i.test(cleaned)) return false;
  if (/^Total:/i.test(cleaned)) return false;
  if (isQuantityLabel(cleaned)) return false;
  if (parsePagueMenosQuantityAndPrice(cleaned)) return false;
  if (extractCategory(cleaned)) return false;

  return /[A-Za-zÀ-ÿ]/.test(cleaned);
};

const mergeByName = (items: ParsedShoppingImportItem[]): ParsedShoppingImportItem[] => {
  const merged = new Map<string, ParsedShoppingImportItem>();

  items.forEach((item) => {
    const key = normalizeText(item.nome);
    const previous = merged.get(key);

    if (!previous) {
      merged.set(key, item);
      return;
    }

    const previousQuantityNumber = parseLocaleNumber(previous.quantidade.split(" ")[0]);
    const itemQuantityNumber = parseLocaleNumber(item.quantidade.split(" ")[0]);
    const previousUnit = previous.quantidade.split(" ")[1] ?? "un";
    const itemUnit = item.quantidade.split(" ")[1] ?? "un";

    const canMergeQuantity = previousUnit === itemUnit;

    merged.set(key, {
      ...previous,
      quantidade: canMergeQuantity
        ? `${formatQuantityNumber(previousQuantityNumber + itemQuantityNumber)} ${previousUnit}`
        : previous.quantidade,
      preco: (previous.preco ?? 0) + (item.preco ?? 0),
    });
  });

  return Array.from(merged.values());
};

const parseTenda = (rawText: string): ParsedShoppingImportItem[] => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsed: ParsedShoppingImportItem[] = [];
  let currentCategory = "Outros";
  let pendingName: string | null = null;
  let pendingQuantity: number | null = null;

  lines.forEach((line) => {
    const category = extractCategory(line);
    if (category) {
      currentCategory = category;
      pendingName = null;
      pendingQuantity = null;
      return;
    }

    const inline = parseInlineTendaLine(line);
    if (inline) {
      parsed.push({ ...inline, categoria: currentCategory });
      pendingName = null;
      pendingQuantity = null;
      return;
    }

    if (pendingName && pendingQuantity !== null) {
      const total = parseTotalLine(line);
      if (total !== null) {
        parsed.push({
          nome: cleanLine(pendingName),
          categoria: currentCategory,
          quantidade: `${formatQuantityNumber(pendingQuantity)} un`,
          preco: total,
        });
        pendingName = null;
        pendingQuantity = null;
        return;
      }
    }

    if (pendingName && pendingQuantity === null && isQuantityLabel(line)) {
      const qty = parseQuantityLabel(line);
      if (qty > 0) {
        pendingQuantity = qty;
      }
      return;
    }

    if (isStoreHeaderLine(line) || /^R\$/i.test(line) || /^Total:/i.test(line)) {
      return;
    }

    if (isLikelyProductLine(line)) {
      if (pendingName && normalizeText(pendingName) === normalizeText(line)) {
        return;
      }
      pendingName = line;
      pendingQuantity = null;
    }
  });

  return mergeByName(parsed);
};

const parsePagueMenos = (rawText: string): ParsedShoppingImportItem[] => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsed: ParsedShoppingImportItem[] = [];
  let pendingName: string | null = null;

  lines.forEach((line) => {
    if (pendingName) {
      const quantityAndPrice = parsePagueMenosQuantityAndPrice(line);
      if (quantityAndPrice) {
        parsed.push({
          nome: cleanLine(pendingName),
          categoria: "Outros",
          quantidade: buildQuantityLabel(pendingName, quantityAndPrice.quantidade),
          preco: quantityAndPrice.total,
        });
        pendingName = null;
        return;
      }
    }

    if (isStoreHeaderLine(line) || /^R\$/i.test(line) || /^Total:/i.test(line)) {
      return;
    }

    if (isLikelyProductLine(line)) {
      if (pendingName && normalizeText(pendingName) === normalizeText(line)) {
        return;
      }
      pendingName = line;
    }
  });

  return mergeByName(parsed);
};

export const parseShoppingImportText = (
  rawText: string,
  options: ParseShoppingImportOptions = {},
): ParsedShoppingImportItem[] => {
  const source = options.source ?? "auto";

  if (source === "tenda") return parseTenda(rawText);
  if (source === "pague-menos") return parsePagueMenos(rawText);

  const autoFromPagueMenos = parsePagueMenos(rawText);
  if (autoFromPagueMenos.length > 0) return autoFromPagueMenos;

  return parseTenda(rawText);
};

export interface ParsedStockImportItem {
  nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
}

export type StockImportSource = "auto" | "tenda" | "pague-menos";

interface ParseStockImportOptions {
  source?: StockImportSource;
}

const CATEGORY_ALIAS: Record<string, string> = {
  mercearia: "Graos e secos",
  hortifruti: "Hortifruti",
  hortifrúti: "Hortifruti",
  "carnes, aves e peixes": "Carnes",
  "higiene e perfumaria": "Higiene",
  limpeza: "Limpeza",
  "frios e laticinios": "Laticinios",
  "frios e laticínios": "Laticinios",
  "paes e bolos": "Outros",
  "pães e bolos": "Outros",
  "marca propria": "Outros",
  "marca própria": "Outros",
};

interface ParsedPackage {
  quantidade: number;
  unidade: string;
}

const normalizeText = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

const toTitleWhitespace = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const parseLocaleNumber = (raw: string): number => {
  const value = raw.trim().replace(/\s+/g, "");

  if (!value) return 0;

  if (value.includes(",") && value.includes(".")) {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    return Number.parseFloat(normalized) || 0;
  }

  if (value.includes(",")) {
    return Number.parseFloat(value.replace(",", ".")) || 0;
  }

  return Number.parseFloat(value) || 0;
};

const isPriceLine = (line: string): boolean => /R\$/i.test(line);

const isTotalLine = (line: string): boolean => /^total\s*:/i.test(line);

const isQuantityLabel = (line: string): boolean => {
  return /^\d+(?:[.,]\d+)?\s+(?:item|itens)$/i.test(line.trim());
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

const parseQuantityFromLabel = (line: string): number => {
  const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s+(?:item|itens)$/i);
  if (!match) return 0;
  return parseLocaleNumber(match[1]);
};

const parseTableQuantityLine = (line: string): number | null => {
  const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s+R\$/i);
  if (!match) return null;
  return parseLocaleNumber(match[1]);
};

const parseInlineItemLine = (
  line: string,
  currentCategory: string,
): ParsedStockImportItem | null => {
  const match = line.trim().match(/^(.*?)\s+R\$\s*[\d.,]+\s+(\d+(?:[.,]\d+)?)\s+(?:item|itens)\b/i);

  if (!match) return null;

  const name = toTitleWhitespace(match[1]);
  const quantity = parseLocaleNumber(match[2]);

  return buildItem(name, currentCategory, quantity);
};

const extractPackageFromName = (name: string): ParsedPackage | null => {
  const normalizedName = name.trim();

  const metricMatch = normalizedName.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  if (metricMatch) {
    return {
      quantidade: parseLocaleNumber(metricMatch[1]),
      unidade: metricMatch[2].toLowerCase() === "l" ? "L" : metricMatch[2].toLowerCase(),
    };
  }

  const dozenMatch = normalizedName.match(/(\d+(?:[.,]\d+)?)\s*(duzias?|dúzias?)\b/i);
  if (dozenMatch) {
    return {
      quantidade: parseLocaleNumber(dozenMatch[1]) * 12,
      unidade: "un",
    };
  }

  const capsuleMatch = normalizedName.match(/(\d+(?:[.,]\d+)?)\s*(capsulas?|cápsulas?)\b/i);
  if (capsuleMatch) {
    return {
      quantidade: parseLocaleNumber(capsuleMatch[1]),
      unidade: "un",
    };
  }

  return null;
};

const inferWeightedQuantity = (name: string, rawQuantity: number): ParsedPackage | null => {
  const normalized = normalizeText(name);
  const hasKgHint = /\bkg\b/.test(normalized);

  if (hasKgHint && rawQuantity >= 1000) {
    return {
      quantidade: rawQuantity / 1000,
      unidade: "kg",
    };
  }

  return null;
};

const isLikelyProductLine = (line: string): boolean => {
  if (line.length < 3) return false;
  if (isStoreHeaderLine(line)) return false;
  if (isPriceLine(line)) return false;
  if (isTotalLine(line)) return false;
  if (isQuantityLabel(line)) return false;
  if (parseTableQuantityLine(line) !== null) return false;
  if (extractCategory(line)) return false;

  return /[A-Za-zÀ-ÿ]/.test(line);
};

const buildItem = (
  pendingName: string,
  currentCategory: string,
  sourceQuantity: number,
): ParsedStockImportItem | null => {
  const cleanedName = toTitleWhitespace(pendingName);
  if (!cleanedName) return null;
  if (sourceQuantity <= 0) return null;

  const packageData = extractPackageFromName(cleanedName);

  if (packageData) {
    return {
      nome: cleanedName,
      categoria: currentCategory,
      quantidade: sourceQuantity * packageData.quantidade,
      unidade: packageData.unidade,
    };
  }

  const inferredWeighted = inferWeightedQuantity(cleanedName, sourceQuantity);
  if (inferredWeighted) {
    return {
      nome: cleanedName,
      categoria: currentCategory,
      quantidade: inferredWeighted.quantidade,
      unidade: inferredWeighted.unidade,
    };
  }

  return {
    nome: cleanedName,
    categoria: currentCategory,
    quantidade: sourceQuantity,
    unidade: "un",
  };
};

const mergeParsedItems = (items: ParsedStockImportItem[]): ParsedStockImportItem[] => {
  const merged = new Map<string, ParsedStockImportItem>();

  items.forEach((item) => {
    const key = `${normalizeText(item.nome)}::${normalizeText(item.unidade)}`;
    const previous = merged.get(key);

    if (!previous) {
      merged.set(key, item);
      return;
    }

    merged.set(key, {
      ...previous,
      quantidade: previous.quantidade + item.quantidade,
    });
  });

  return Array.from(merged.values());
};

const parsePagueMenosLineMode = (rawText: string): ParsedStockImportItem[] => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsed: ParsedStockImportItem[] = [];
  let pendingName: string | null = null;

  lines.forEach((line) => {
    if (pendingName) {
      const tableQuantity = parseTableQuantityLine(line);
      if (tableQuantity !== null) {
        const built = buildItem(pendingName, "Outros", tableQuantity);
        if (built) parsed.push(built);
        pendingName = null;
        return;
      }
    }

    if (isStoreHeaderLine(line) || isPriceLine(line) || isTotalLine(line)) {
      return;
    }

    if (isLikelyProductLine(line)) {
      if (pendingName && normalizeText(pendingName) === normalizeText(line)) {
        return;
      }
      pendingName = line;
    }
  });

  return mergeParsedItems(parsed).filter((item) => item.quantidade > 0);
};

export const parseStockImportText = (
  rawText: string,
  options: ParseStockImportOptions = {},
): ParsedStockImportItem[] => {
  const source = options.source ?? "auto";

  if (source === "pague-menos") {
    return parsePagueMenosLineMode(rawText);
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const parsed: ParsedStockImportItem[] = [];
  let currentCategory = "Outros";
  let pendingName: string | null = null;

  lines.forEach((line) => {
    const category = extractCategory(line);
    if (category) {
      currentCategory = category;
      pendingName = null;
      return;
    }

    const inlineItem = parseInlineItemLine(line, currentCategory);
    if (inlineItem) {
      parsed.push(inlineItem);
      pendingName = null;
      return;
    }

    if (pendingName) {
      const listQuantity = parseQuantityFromLabel(line);
      if (listQuantity > 0) {
        const built = buildItem(pendingName, currentCategory, listQuantity);
        if (built) parsed.push(built);
        pendingName = null;
        return;
      }

      const tableQuantity = parseTableQuantityLine(line);
      if (tableQuantity !== null) {
        const built = buildItem(pendingName, currentCategory, tableQuantity);
        if (built) parsed.push(built);
        pendingName = null;
        return;
      }
    }

    if (isStoreHeaderLine(line) || isPriceLine(line) || isTotalLine(line)) {
      return;
    }

    if (isLikelyProductLine(line)) {
      if (pendingName && normalizeText(pendingName) === normalizeText(line)) {
        return;
      }
      pendingName = line;
    }
  });

  return mergeParsedItems(parsed).filter((item) => item.quantidade > 0);
};

import { extractProductSize } from "./tendaService";
import type { ProductSize } from "./tendaService";
import { supabase } from "../lib/supabase";

/**
 * Base de marcas conhecidas para inicialização imediata e fallback (mesmo sem internet).
 * Cresce automaticamente com o uso através da função recordDiscoveredBrand.
 */
const KNOWN_BRANDS = new Set([
  "camil",
  "namorado",
  "kicaldo",
  "tio joao",
  "tio joão",
  "pilao",
  "pilão",
  "melitta",
  "3 coracoes",
  "3 corações",
  "uniao",
  "união",
  "nestle",
  "nestlé",
  "omo",
  "ype",
  "ypê",
  "bauducco",
  "dona benta",
  "qualita",
  "qualitá",
  "select",
  "da casa",
  "garoto",
  "lacta",
  "sadia",
  "perdigao",
  "perdigão",
  "seara",
  "aurora",
  "coca-cola",
  "coca cola",
  "pepsi",
  "guarana antarctica",
  "guaraná antarctica",
  "italac",
  "piracanjuba",
  "parmalat",
  "elegance",
  "gallo",
  "andorinha",
  "borges",
  "haze",
  "heinz",
  "hellmanns",
  "hellmann's",
  "quero",
  "fugini",
  "predilecta",
  "ajinomoto",
  "sazon",
  "sazón",
  "maggi",
  "knorr",
  "kitano",
  "limpol",
  "minuano",
  "brilhante",
  "tixan",
  "ariel",
  "comfort",
  "downy",
  "fofo",
  "veja",
  "urca",
  "bombril",
  "assolan",
  "pampers",
  "huggies",
  "turma da monica",
  "turma da mônica",
  "colgate",
  "sorriso",
  "close up",
  "oral-b",
  "oral b",
  "dove",
  "rexona",
  "nivea",
  "nívea",
  "seda",
  "pantene",
  "tresemme",
  "tresemmé",
  "clear",
  "head & shoulders",
  "monange",
  "paixao",
  "paixão",
  "johnson & johnson",
  "johnson's",
  "listerine",
  "band-aid",
  "cotonetes",
  "intimus",
  "always",
  "sym",
  "personal",
  "neve",
  "scott",
  "mili",
  "prato fino",
  "broto legal",
  "estrela",
  "renata",
  "adrin",
  "panco",
  "pullman",
  "nutrella",
  "wickbold",
  "visconti",
  "santa edwiges",
  "toddy",
  "nescau",
  "italiano",
  "café brasileiro",
  "cafe brasileiro",
  "damasco",
  "pimpinela",
  "marata",
  "maratá",
  "santa clara",
]);

/**
 * Interface de resultado da decomposição de um nome de produto.
 */
export interface ProductParts {
  rawName: string;
  baseProduct: string;
  brand: string | null;
  size: ProductSize | null;
}

/**
 * Normaliza um texto para facilitar a busca (remove acentos e converte para minúsculas).
 */
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

/**
 * Registra assincronamente um lote de novas marcas no banco de dados e no cache local.
 * Utiliza upsert com ignoreDuplicates para evitar requisições 409 repetitivas.
 *
 * @param brandNames Lista de nomes de marcas retornados pela API
 */
export const recordDiscoveredBrands = async (brandNames: string[]): Promise<void> => {
  const newBrandsToInsert: { nome: string; nome_normalizado: string; origem: string }[] = [];

  for (const brandName of brandNames) {
    if (!brandName || brandName.trim() === "") continue;
    const normalized = normalizeText(brandName);

    if (!KNOWN_BRANDS.has(normalized)) {
      KNOWN_BRANDS.add(normalized);
      newBrandsToInsert.push({
        nome: brandName.trim(),
        nome_normalizado: normalized,
        origem: "tenda",
      });
    }
  }

  if (newBrandsToInsert.length === 0) return;

  try {
    await supabase
      .from("brand_dictionary")
      .upsert(newBrandsToInsert, { onConflict: "nome_normalizado", ignoreDuplicates: true });
  } catch {
    // Erros silenciosos (ex: offline, tabela ainda não criada pela migration)
  }
};

/**
 * Registra assincronamente uma nova marca no banco de dados e no cache local.
 *
 * @param brandName O nome da marca original retornado pela API
 */
export const recordDiscoveredBrand = async (brandName: string): Promise<void> => {
  await recordDiscoveredBrands([brandName]);
};

/**
 * Retorna a quantidade total de marcas ativas no cache em memória.
 */
export const getKnownBrandsCount = (): number => {
  return KNOWN_BRANDS.size;
};

/**
 * Carrega e sincroniza o dicionário de marcas a partir do Supabase.
 * Enriquece a base em memória com todas as marcas cadastradas globalmente.
 */
export const syncBrandDictionaryFromSupabase = async (): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from("brand_dictionary")
      .select("nome, nome_normalizado")
      .eq("ativo", true);

    if (error) {
      console.warn(
        "[brandDictionaryService] Falha ao sincronizar marcas do Supabase:",
        error.message,
      );
      return;
    }

    if (data) {
      data.forEach((item) => {
        if (item.nome_normalizado) {
          KNOWN_BRANDS.add(item.nome_normalizado.toLowerCase());
        }
      });
    }
  } catch (err) {
    console.warn("[brandDictionaryService] Erro inesperado ao sincronizar marcas:", err);
  }
};

/**
 * Analisa o nome de um item e extrai suas partes constituintes (Produto Base, Marca e Tamanho/Peso).
 *
 * @param itemName Nome original cadastrado pelo usuário
 * @returns Objeto com as partes extraídas
 */
export const extractProductParts = (itemName: string): ProductParts => {
  const size = extractProductSize(itemName);

  let foundBrand: string | null = null;
  let brandOriginalCase: string | null = null;

  // Extrai tamanho do texto para não confundir
  let nameWithoutSize = itemName;
  if (size) {
    // Regex para remover o tamanho identificado (ignorando case)
    const sizeRegex = new RegExp(`\\b${size.value}(?:\\.\\d+)?\\s*${size.unit}\\b`, "gi");
    nameWithoutSize = nameWithoutSize.replace(sizeRegex, "").trim();
  }

  // Tenta encontrar uma marca conhecida dentro do nome
  // Ordena as marcas por comprimento decrescente para priorizar "coca-cola" em vez de "coca"
  const sortedBrands = Array.from(KNOWN_BRANDS).sort((a, b) => b.length - a.length);

  for (const b of sortedBrands) {
    // Para bater com o texto original acentuado, construímos um regex flexível para cada letra
    const accentInsensitivePattern = b
      .split("")
      .map((char) => {
        if (/[aáàâãä]/i.test(char)) return "[aáàâãä]";
        if (/[eéèêë]/i.test(char)) return "[eéèêë]";
        if (/[iíìîï]/i.test(char)) return "[iíìîï]";
        if (/[oóòôõö]/i.test(char)) return "[oóòôõö]";
        if (/[uúùûü]/i.test(char)) return "[uúùûü]";
        if (/[cç]/i.test(char)) return "[cç]";
        return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");

    const regexOriginal = new RegExp(
      `(?<=^|[^\\p{L}\\d])${accentInsensitivePattern}(?=$|[^\\p{L}\\d])`,
      "iu",
    );
    const originalMatch = nameWithoutSize.match(regexOriginal);

    if (originalMatch) {
      foundBrand = b;
      brandOriginalCase = originalMatch[0];
      break;
    }
  }

  let baseProduct = nameWithoutSize;

  if (foundBrand && brandOriginalCase) {
    // Escapa caracteres especiais do case original para o regex de substituição
    const escapedCase = brandOriginalCase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const removeRegex = new RegExp(`(?<=^|[^\\p{L}\\d])${escapedCase}(?=$|[^\\p{L}\\d])`, "gu");
    baseProduct = baseProduct.replace(removeRegex, "");
  }

  // Limpa espaços duplos e stopwords comuns residuais (tipo, de, com) que possam ter ficado nas pontas
  baseProduct = baseProduct
    .replace(/\s+/g, " ")
    .replace(/\b(?:tipo\s*\d+)\b/gi, "")
    .replace(/^(?:de|com|sabor)\s+/i, "")
    .replace(/\s+(?:de|com|sabor)$/i, "")
    .replace(/[^\p{L}\d\s.,-]/gu, "")
    .trim();

  // Capitaliza primeira letra
  if (baseProduct.length > 0) {
    baseProduct = baseProduct.charAt(0).toUpperCase() + baseProduct.slice(1);
  }

  return {
    rawName: itemName,
    baseProduct: baseProduct || itemName,
    brand: brandOriginalCase,
    size,
  };
};

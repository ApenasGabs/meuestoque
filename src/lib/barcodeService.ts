import { supabase } from './supabase';

export interface BarcodeResult {
  found: boolean;
  source: 'supabase' | 'openfoodfacts' | 'none';
  ean: string;
  name?: string;
  unit?: string;
  category?: string;
  productId?: string;
}

const eanCache = new Map<string, BarcodeResult>();
const EAN_COOLDOWN_MS = 3000;
const lastProcessed = new Map<string, number>();

export function isValidEan(ean: string): boolean {
  return /^\d{8,14}$/.test(ean);
}

const OPENFOODFACTS_TIMEOUT_MS = 5000;

export async function resolveProductByEan(
  ean: string,
  groupId: string,
): Promise<BarcodeResult> {
  if (!isValidEan(ean)) {
    return { found: false, source: 'none', ean };
  }

  const cached = eanCache.get(`${groupId}:${ean}`);
  if (cached) return cached;

  // Busca interna (Supabase)
  const { data: localProduct } = await supabase
    .from('product_catalog')
    .select('id, nome, categoria, unidade_estoque')
    .eq('group_id', groupId)
    .eq('ean', ean)
    .maybeSingle();

  if (localProduct) {
    const result: BarcodeResult = {
      found: true,
      source: 'supabase',
      ean,
      name: localProduct.nome,
      unit: localProduct.unidade_estoque,
      category: localProduct.categoria,
      productId: localProduct.id,
    };
    eanCache.set(`${groupId}:${ean}`, result);
    return result;
  }

  // Busca externa (OpenFoodFacts)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENFOODFACTS_TIMEOUT_MS);

    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${ean}.json`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    const data = await response.json();

    if (data.status === 1 && data.product?.product_name) {
      const fullName = data.product.brands
        ? `${data.product.product_name} - ${data.product.brands}`
        : data.product.product_name;

      const result: BarcodeResult = {
        found: true,
        source: 'openfoodfacts',
        ean,
        name: fullName,
      };
      eanCache.set(`${groupId}:${ean}`, result);
      return result;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('OpenFoodFacts timeout para EAN:', ean);
    } else {
      console.warn('Erro ao consultar OpenFoodFacts:', error);
    }
  }

  const result: BarcodeResult = { found: false, source: 'none', ean };
  return result;
}

export async function saveEanMapping(
  groupId: string,
  ean: string,
  nome: string,
  unidade: string = 'Un',
  categoria: string = 'Outros',
): Promise<string> {
  const { data: existing } = await supabase
    .from('product_catalog')
    .select('id')
    .eq('group_id', groupId)
    .ilike('nome', nome.trim())
    .eq('unidade_estoque', unidade)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('product_catalog')
      .update({ ean })
      .eq('id', existing.id);
    
    eanCache.set(`${groupId}:${ean}`, {
      found: true,
      source: 'supabase',
      ean,
      name: nome,
      productId: existing.id,
      unit: unidade,
    });

    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('product_catalog')
    .insert({
      group_id: groupId,
      nome: nome.trim(),
      categoria,
      ean,
      unidade_estoque: unidade,
      unidade_tipo: 'simple',
      porcao_padrao: 1,
      unidade_porcao: 'un',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  eanCache.set(`${groupId}:${ean}`, {
    found: true,
    source: 'supabase',
    ean,
    name: nome.trim(),
    productId: created.id,
    unit: unidade,
    category: categoria,
  });

  return created.id;
}

export function isEanInCooldown(ean: string): boolean {
  const last = lastProcessed.get(ean);
  if (!last) return false;
  return Date.now() - last < EAN_COOLDOWN_MS;
}

export function markEanProcessed(ean: string): void {
  lastProcessed.set(ean, Date.now());
}

# 📋 Especificação Técnica v2: Leitor de Código de Barras (EAN/UPC)

> **Versão:** 2.0 — Revisada com base na análise de lacunas da v1  
> **Stack:** React 19, Zustand 5, Supabase, Tailwind 4 + daisyUI 5  
> **Princípios:** Zero Fricção · Input Inteligente · Aprendizado Progressivo

---

## 1. Visão Geral

Esta feature introduz a capacidade de ler códigos de barras via câmera do dispositivo (PWA/Web) para acelerar dois fluxos:

1. **Lista de Compras** — Adicionar itens pelo código de barras com auto-preenchimento do nome.
2. **Auditoria de Estoque** — Dar baixa ou ajustar quantidade de itens existentes no estoque.

### 1.1. Filosofia: Aprendizado Progressivo

O sistema opera em cascata silenciosa:

```
EAN escaneado
  → 1) Busca no product_catalog (Supabase, scope do grupo)
  → 2) Busca na API OpenFoodFacts (gratuita, sem auth)
  → 3) Fallback: pede nome ao usuário e **salva o mapeamento**
```

A partir do segundo scan do mesmo produto, a resposta é instantânea (banco local).

---

## 2. Banco de Dados (Supabase)

### 2.1. Migration: Adicionar coluna `ean` ao `product_catalog`

**Arquivo:** `supabase/migrations/YYYYMMDD_add_ean_to_catalog.sql`

```sql
-- Adiciona coluna EAN ao catálogo de produtos
-- Usa tipo TEXT para consistência com o schema existente
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS ean text DEFAULT NULL;

-- Validação: EAN deve ter entre 8 e 14 caracteres numéricos (EAN-8, UPC-A, EAN-13)
ALTER TABLE public.product_catalog
  ADD CONSTRAINT chk_product_catalog_ean_format
  CHECK (ean IS NULL OR (length(ean) BETWEEN 8 AND 14 AND ean ~ '^\d+$'));

-- Índice UNIQUE parcial: garante que o mesmo código de barras
-- não pode ser mapeado a dois nomes diferentes dentro do mesmo grupo
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_catalog_group_ean
  ON public.product_catalog (group_id, ean)
  WHERE ean IS NOT NULL;

COMMENT ON COLUMN public.product_catalog.ean
  IS 'Código de barras EAN-8/EAN-13/UPC-A. Usado para auto-preenchimento via scanner. Único por grupo.';
```

**Decisões de design:**
- `text` ao invés de `VARCHAR(50)` — mantém consistência com todo o schema existente.
- `UNIQUE` parcial (`WHERE ean IS NOT NULL`) — permite múltiplos produtos sem EAN, mas impede duplicatas quando preenchido.
- `CHECK` regex — valida formato numérico no banco, evitando dados sujos.
- **Sem coluna `ean` em `stock_items` ou `items`** — o EAN vive exclusivamente no `product_catalog`. A relação é feita via `product_id` (FK já existente em ambas as tabelas).

### 2.2. RLS

As policies existentes em `product_catalog` já cobrem a nova coluna automaticamente (SELECT/INSERT/UPDATE/DELETE filtram por `is_group_member(group_id)`).

**Decisão explícita:** A busca por EAN é **sempre scoped ao `group_id`** do usuário. Não há busca cross-group. Se no futuro quisermos compartilhar mapeamentos EAN entre grupos, será uma feature separada.

---

## 3. Tipagens

### 3.1. Novo tipo: `ProductCatalogRecord`

**Arquivo:** `src/lib/webData.ts` (junto aos demais records)

```typescript
export interface ProductCatalogRecord {
  id: string;
  group_id: string;
  nome: string;
  categoria: string;
  unidade_estoque: string;
  ean: string | null;
}
```

### 3.2. Interface de resultado do barcode

**Arquivo:** `src/lib/barcodeService.ts` (novo)

```typescript
export interface BarcodeResult {
  found: boolean;
  source: 'supabase' | 'openfoodfacts' | 'none';
  ean: string;
  name?: string;
  unit?: string;        // unidade_estoque do product_catalog
  category?: string;    // categoria do product_catalog
  productId?: string;   // id do product_catalog (para match com stock_items)
}
```

**Nota:** `StockItemRecord` em `webData.ts` NÃO precisa receber campo `ean`. O match no estoque é feito via `product_id`, que já existe tanto no `stock_items` quanto no `product_catalog`.

---

## 4. Camada de Dados: `src/lib/barcodeService.ts`

Arquivo novo, isolado do `webData.ts` para manter separação de responsabilidades.

### 4.1. Cache em memória (por sessão)

```typescript
const eanCache = new Map<string, BarcodeResult>();
const EAN_COOLDOWN_MS = 3000; // cooldown entre processamentos do mesmo EAN
const lastProcessed = new Map<string, number>();
```

### 4.2. Validação de formato

```typescript
export function isValidEan(ean: string): boolean {
  return /^\d{8,14}$/.test(ean);
}
```

### 4.3. Busca em cascata

```typescript
import { supabase } from './supabase';

const OPENFOODFACTS_TIMEOUT_MS = 5000;

export async function resolveProductByEan(
  ean: string,
  groupId: string,
): Promise<BarcodeResult> {
  // 0. Validação
  if (!isValidEan(ean)) {
    return { found: false, source: 'none', ean };
  }

  // 1. Cache de sessão
  const cached = eanCache.get(`${groupId}:${ean}`);
  if (cached) return cached;

  // 2. Busca interna (Supabase — product_catalog do grupo)
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

  // 3. Busca externa (OpenFoodFacts — gratuito, sem CORS issues)
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

  // 4. Não encontrado
  const result: BarcodeResult = { found: false, source: 'none', ean };
  // Não cacheia fallback — o usuário pode tentar novamente
  return result;
}
```

### 4.4. Persistência do mapeamento EAN → nome

Função chamada quando o usuário fornece o nome de um produto desconhecido:

```typescript
/**
 * Salva o mapeamento EAN → nome no product_catalog do grupo.
 * Se o produto já existe (por nome+unidade), apenas atualiza o EAN.
 * Se não existe, cria um novo registro.
 */
export async function saveEanMapping(
  groupId: string,
  ean: string,
  nome: string,
  unidade: string = 'Un',
  categoria: string = 'Outros',
): Promise<string> {
  // Tenta encontrar um product_catalog existente pelo nome
  const { data: existing } = await supabase
    .from('product_catalog')
    .select('id')
    .eq('group_id', groupId)
    .ilike('nome', nome.trim())
    .eq('unidade_estoque', unidade)
    .maybeSingle();

  if (existing) {
    // Atualiza o EAN do produto existente
    await supabase
      .from('product_catalog')
      .update({ ean })
      .eq('id', existing.id);
    
    // Atualiza o cache
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

  // Cria novo produto no catálogo
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
```

### 4.5. Cooldown helper (para modo contínuo)

```typescript
export function isEanInCooldown(ean: string): boolean {
  const last = lastProcessed.get(ean);
  if (!last) return false;
  return Date.now() - last < EAN_COOLDOWN_MS;
}

export function markEanProcessed(ean: string): void {
  lastProcessed.set(ean, Date.now());
}
```

---

## 5. Componente UI: `<BarcodeScannerModal />`

**Arquivo:** `src/components/Scanner/BarcodeScannerModal.tsx`

### 5.1. Estratégia de detecção (Progressive Enhancement)

```
1. Verificar `window.isSecureContext` → se false, não renderizar botão
2. Verificar `'BarcodeDetector' in window` → se disponível, usar API nativa (zero bundle)
3. Fallback → carregar `html5-qrcode` via dynamic import (lazy loading)
```

**Motivo:** A `BarcodeDetector API` já é suportada nativamente em Chrome/Edge (que são os browsers mais comuns para PWAs). Isso economiza ~50KB de bundle para a maioria dos usuários. O `html5-qrcode` é carregado sob demanda apenas quando necessário (Safari, Firefox).

### 5.2. Props e comportamento

```typescript
interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  /** Chamado quando um EAN válido é detectado */
  onScan: (ean: string) => void;
  /** Se true, não fecha o modal após a 1ª leitura (modo auditoria) */
  continuous?: boolean;
}
```

**Comportamento:**
- Pede permissão de câmera **apenas** quando o modal for aberto.
- Fecha a câmera (para poupar bateria) ao desmontar ou ao detectar um código válido (exceto no modo contínuo).
- **Debounce de 300ms** entre detecções para evitar chamadas duplicadas.
- **Cooldown de 3s por EAN** — após processar um código com sucesso, ignora leituras do mesmo código pelos próximos 3 segundos.
- Feedback visual: mostra o último EAN lido com um mini-card animado (fade-in/fade-out).
- Feedback sonoro/háptico: `navigator.vibrate(100)` em detecções bem-sucedidas (com feature detection).

### 5.3. Tratamento de permissão negada

```tsx
// Dentro do modal, se câmera negada:
<Alert type="warning">
  Precisamos de acesso à câmera para ler os códigos. 
  Verifique as configurações do seu navegador.
</Alert>
```

### 5.4. Render condicional (HTTPS)

O botão de scanner deve ser **escondido** em contextos inseguros:

```typescript
const canUseCamera = typeof window !== 'undefined' && window.isSecureContext;
```

### 5.5. Uso do Modal existente

O componente reutiliza o `<Modal />` existente em `src/components/Modal/Modal.tsx` como wrapper, mantendo consistência visual com o resto do app.

---

## 6. Fluxos de UX e Integração nas Páginas

### 6.1. Lista de Compras (`ListPageNew.tsx`)

**Objetivo:** Alimentar o "Input Inteligente" de forma mágica.

#### UI

Adicionar um ícone de câmera (`📸`) **ao lado do input** de adição rápida no `ShoppingListView`. O botão só aparece quando `canUseCamera === true`.

#### Fluxo Completo

```
                        ┌──────────────────┐
                        │  Usuário clica 📸 │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Abre Scanner    │
                        │  (modo single)   │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  EAN detectado   │
                        └────────┬─────────┘
                                 │
                   ┌─────────────▼──────────────┐
                   │  resolveProductByEan()      │
                   │  (cascata: Supabase → OFF)  │
                   └─────────────┬──────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
           ┌───────▼───────┐        ┌────────▼────────┐
           │  ENCONTRADO   │        │  NÃO ENCONTRADO │
           └───────┬───────┘        └────────┬────────┘
                   │                         │
         ┌─────────▼──────────┐     ┌────────▼────────────┐
         │ Modal fecha.       │     │ Modal fecha.        │
         │ Input recebe:      │     │ Toast:              │
         │ "Nome Produto, 1"  │     │ "Código não         │
         │                    │     │  reconhecido.       │
         │ Usuário pode       │     │  Digite o nome!"    │
         │ editar qty/preço   │     │                     │
         │ e pressionar Enter │     │ Input fica focado.  │
         └─────────┬──────────┘     │ pendingEan = ean    │
                   │                └────────┬────────────┘
                   │                         │
                   │              ┌──────────▼────────────┐
                   │              │ Usuário digita nome   │
                   │              │ e salva o item        │
                   │              └──────────┬────────────┘
                   │                         │
                   │              ┌──────────▼────────────┐
                   │              │ saveEanMapping()      │
                   │              │ Salva EAN → nome no   │
                   │              │ product_catalog       │
                   │              └───────────────────────┘
                   │
                   ▼
            Item na lista ✓
```

#### Implementação no `ListPageNew.tsx`

**Novo estado:**

```typescript
const [scannerOpen, setScannerOpen] = useState(false);
const [pendingEan, setPendingEan] = useState<string | null>(null);
```

**Handler do scan:**

```typescript
const handleBarcodeScan = useCallback(async (ean: string) => {
  setScannerOpen(false);

  const result = await resolveProductByEan(ean, groupId!);
  
  if (result.found && result.name) {
    // Auto-preenche o input com o nome do produto
    // (comunicação com ShoppingListView via ref ou callback)
    injectIntoSmartInput(result.name, 1);
    setNotice(`📸 ${result.name}`);
  } else {
    // Produto desconhecido — guarda o EAN para salvar depois
    setPendingEan(ean);
    setNotice('Código não reconhecido. Digite o nome para o sistema aprender!');
    focusSmartInput();
  }
}, [groupId]);
```

**Ao salvar um item com `pendingEan`:**

```typescript
// Dentro do handleSmartAdd existente, após o addListItem:
if (pendingEan) {
  await saveEanMapping(groupId!, pendingEan, itemName, payload.unit, payload.category);
  setPendingEan(null);
}
```

#### Resultado para o usuário

- **1ª vez** escaneando "Molho de Tomate Heinz": busca na OpenFoodFacts, preenche automaticamente. Na próxima compra, resposta instantânea do banco local.
- **Produto artesanal** sem EAN cadastrado em lugar nenhum: usuário digita "Pão da Dona Maria", e nas próximas vezes o scan preenche automaticamente.

---

### 6.2. Sessão de Estoque / Auditoria (`StockPageNew.tsx`)

**Objetivo:** Agilizar a auditoria do que já está na despensa.

#### UI

Adicionar um FAB (Floating Action Button) de "Auditoria Rápida" na tela de estoque, posicionado acima da bottom nav:

```tsx
{canUseCamera && (
  <button
    className="fixed bottom-24 right-4 btn btn-primary btn-circle btn-lg shadow-xl z-20"
    onClick={() => setScannerOpen(true)}
    aria-label="Auditoria por código de barras"
  >
    📸
  </button>
)}
```

#### Fluxo de Auditoria (Modo Contínuo)

```
            ┌────────────────────────┐
            │  Scanner abre em modo  │
            │  CONTÍNUO              │
            └───────────┬────────────┘
                        │
               ┌────────▼────────┐
               │  EAN detectado  │◄─── Debounce 300ms
               └────────┬────────┘     Cooldown 3s/EAN
                        │
          ┌─────────────▼────────────────┐
          │ resolveProductByEan()        │
          └─────────────┬────────────────┘
                        │
          ┌─────────────▼────────────────┐
          │ Busca no Zustand:            │
          │ stockItems.find(             │
          │   i => i.product_id === pid  │
          │   || i.nome === name         │
          │ )                            │
          └─────────────┬────────────────┘
                        │
           ┌────────────┴────────────┐
           │                         │
  ┌────────▼────────┐      ┌────────▼─────────────┐
  │ EXISTE no       │      │ NÃO EXISTE no        │
  │ estoque atual   │      │ estoque atual        │
  └────────┬────────┘      └────────┬─────────────┘
           │                        │
  ┌────────▼────────────┐  ┌────────▼─────────────┐
  │ Vibração (100ms)    │  │ Scanner pausa        │
  │ Navega para:        │  │ Toast interativo:    │
  │ /stock/item/{id}    │  │ "Item não está no    │
  │                     │  │  estoque. Adicionar?"│
  │ Usuário ajusta      │  │                      │
  │ quantidade e volta  │  │  [Sim]  →  Navega p/ │
  └─────────────────────┘  │    /stock com modal  │
                           │    de add aberto     │
                           │                      │
                           │  [Não]  → Retoma     │
                           │    scanner           │
                           └──────────────────────┘
```

**Decisão de UX sobre "Bottom Sheet":**  
O app já possui a rota `/stock/item/:itemId` com o componente `StockItemDetailsPage`. Para a v1 do scanner, **navegar para essa rota existente** é mais simples e já oferece toda a funcionalidade necessária (ver quantidade, lotes, movimentações). Uma Bottom Sheet inline pode ser adicionada em uma v2 futura para fluxo mais fluido.

#### Implementação no `StockPageNew.tsx`

**Handler de scan na auditoria:**

```typescript
const handleAuditScan = useCallback(async (ean: string) => {
  if (isEanInCooldown(ean)) return;
  markEanProcessed(ean);

  const result = await resolveProductByEan(ean, groupId!);
  
  if (!result.found) {
    setToast({ 
      message: 'Produto não reconhecido. Escaneie outro ou adicione manualmente.',
      type: 'error' 
    });
    return;
  }

  // Busca no estado local do Zustand
  const stockItems = useStockStore.getState().items;
  const matchedItem = stockItems.find(item => 
    // Match por product_id (mais preciso)
    (result.productId && item.product_id === result.productId) ||
    // Fallback: match por nome (para items sem product_id)
    item.nome.trim().toLowerCase() === result.name?.trim().toLowerCase()
  );

  if (matchedItem) {
    // Item existe no estoque — vibra e navega para detalhes
    if (navigator.vibrate) navigator.vibrate(100);
    navigate(`/stock/item/${matchedItem.id}`);
  } else {
    // Item não está no estoque — perguntar se quer adicionar
    setScannerOpen(false); // Pausa o scanner
    setPendingAuditProduct(result);
    setShowAddPrompt(true);
  }
}, [groupId, navigate]);
```

**Nota:** O `StockItemRecord` precisa incluir `product_id` no select query. Verificar se `getStockItems()` em `webData.ts` já retorna esse campo (atualmente não está no select string, mas existe na tabela). Adicionar `product_id` ao select e ao tipo.

---

## 7. Atualização no `StockItemRecord`

### 7.1. Adicionar `product_id` ao tipo e queries

**Arquivo:** `src/lib/webData.ts`

O campo `product_id` já existe na tabela `stock_items` (adicionado na migration inicial), mas não é retornado nas queries atuais. Adicionar:

```typescript
// No StockItemRecord:
export interface StockItemRecord {
  // ... campos existentes ...
  product_id: string | null;  // ← ADICIONAR
}
```

E atualizar os selects em `getStockItems()`, `getStockItemById()`, `upsertStockItem()` para incluir `product_id` na string de colunas.

---

## 8. Tratamento de Exceções e Edge Cases

### 8.1. Permissão de Câmera Negada
- Exibir um `<Alert type="warning">` dentro do modal do scanner.

### 8.2. Ambientes sem HTTPS
- O botão de scanner é **escondido** (`render condicional`) quando `window.isSecureContext === false`.
- Funciona normalmente em `localhost` (contexto seguro por definição).

### 8.3. Variação de Embalagens
- O EAN do pacote de 4 rolos é diferente do EAN do pacote de 12 rolos. Cada um é um mapeamento separado no `product_catalog`. O parser de input da lista de compras cuida do resto.

### 8.4. Múltiplos Produtos com Mesmo Nome (Unidades Diferentes)
- O `UNIQUE INDEX` é em `(group_id, ean)`, não em `(group_id, nome)`. Dois EANs diferentes podem mapear para o mesmo nome (ex: "Arroz 1kg" e "Arroz 5kg"). Isso é correto — são produtos com códigos de barras distintos.

### 8.5. Leitura Rápida/Repetida (Modo Contínuo)
- **Debounce:** 300ms entre detecções consecutivas do scanner.
- **Cooldown por EAN:** 3 segundos após processar um código. Evita que a câmera re-processe o mesmo item enquanto o usuário move o produto.
- **Feedback visual:** Card flutuante no topo do scanner mostrando "✓ Molho de Tomate — há 2s".

### 8.6. Rede Lenta/Offline
- **OpenFoodFacts timeout:** 5 segundos via `AbortController`.
- **Sem conexão:** A busca no Supabase falha silenciosamente, e o fallback para "não encontrado" é exibido. O usuário pode digitar o nome manualmente.
- **Retry:** Não implementar retry automático na v1. O usuário pode escanear novamente.

---

## 9. Dependência: Escolha da Biblioteca de Scanner

### 9.1. Estratégia: Progressive Enhancement

| Abordagem | Bundle Cost | Suporte | Uso |
|---|---|---|---|
| `BarcodeDetector` API nativa | 0 KB | Chrome 83+, Edge 83+, Opera, Samsung Browser | Padrão |
| `html5-qrcode` (fallback) | ~50 KB | Todos os browsers | Lazy loaded |

**Implementação:**

```typescript
// src/lib/scannerDetector.ts
export async function createBarcodeScanner(): Promise<...> {
  // Tenta API nativa primeiro
  if ('BarcodeDetector' in window) {
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
    return new NativeBarcodeScanner(detector);
  }
  
  // Fallback: carrega html5-qrcode sob demanda
  const { Html5QrcodeScanner } = await import('html5-qrcode');
  return new Html5QrcodeScanner(/* config */);
}
```

**Nota:** Antes de instalar `html5-qrcode`, validar versão e segurança do pacote conforme processo de scan_dependencies.

---

## 10. Impactos na Arquitetura (Resumo)

| Camada | Arquivo | Ação |
|---|---|---|
| **Database** | `supabase/migrations/YYYYMMDD_add_ean_to_catalog.sql` | Coluna `ean` + unique index parcial + CHECK constraint |
| **Service** | `src/lib/barcodeService.ts` | **[NOVO]** Cascata de busca + cache + persistência EAN |
| **Service** | `src/lib/webData.ts` | Adicionar `product_id` ao `StockItemRecord` e queries |
| **Scanner** | `src/lib/scannerDetector.ts` | **[NOVO]** Factory para detector nativo vs fallback |
| **UI** | `src/components/Scanner/BarcodeScannerModal.tsx` | **[NOVO]** Modal genérico de scanner |
| **Page** | `src/pages/ListPageNew.tsx` | Botão câmera + `pendingEan` + integração com smart input |
| **Page** | `src/pages/StockPageNew.tsx` | FAB de auditoria + modo contínuo + navegação para detalhes |

---

## 11. Critérios de Aceite

### Lista de Compras
- [ ] Botão de câmera visível apenas em HTTPS/localhost
- [ ] Scan de EAN conhecido (Supabase) preenche input automaticamente
- [ ] Scan de EAN desconhecido localmente mas existente na OpenFoodFacts preenche input
- [ ] Scan de EAN totalmente desconhecido mostra toast + foca input
- [ ] Ao salvar item com `pendingEan`, o mapeamento é persistido no `product_catalog`
- [ ] Segundo scan do mesmo produto retorna resultado instantâneo (cache local)

### Auditoria de Estoque
- [ ] FAB de auditoria visível apenas em HTTPS/localhost
- [ ] Scanner abre em modo contínuo
- [ ] Item existente no estoque: vibra + navega para `/stock/item/:id`
- [ ] Item não existente: pausa scanner + mostra prompt de adição
- [ ] Debounce de 300ms e cooldown de 3s por EAN funcionando
- [ ] Scanner fecha automaticamente ao sair da página

### Geral
- [ ] Permissão de câmera negada mostra alert informativo
- [ ] OpenFoodFacts com timeout de 5s
- [ ] EAN inválido (menos de 8 ou mais de 14 dígitos) é rejeitado silenciosamente

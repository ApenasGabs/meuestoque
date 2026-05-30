Aqui está a especificação técnica detalhada em Markdown, estruturada especificamente para a arquitetura do **Meu Estoque** (React 19, Zustand, Supabase e daisyUI), respeitando as regras de "Zero Fricção" e "Input Inteligente".

Você pode copiar este conteúdo e salvar como `docs/features/feature-barcode-scanner.md` no seu repositório.

---

# 📋 Especificação Técnica: Leitor de Código de Barras (EAN/UPC)

## 1. Visão Geral

Esta feature introduz a capacidade de ler códigos de barras via câmera do dispositivo (PWA/Web) para acelerar a adição de itens na Lista de Compras e a auditoria de itens na Sessão de Estoque. A premissa central é o "Zero Fricção": o sistema deve tentar resolver o nome do produto silenciosamente em cascata (Banco Local -> API Externa) e só interromper o usuário se o produto for totalmente desconhecido.

---

## 2. Banco de Dados (Supabase)

O catálogo de produtos (`product_catalog`) precisa ser expandido para memorizar a relação entre o código de barras (`ean`) e o nome dado pelo usuário dentro do escopo do seu grupo (`group_id`).

### 2.1. Migration

Criar um novo arquivo de migration em `supabase/migrations/YYYYMMDD_add_ean_to_catalog.sql`:

```sql
-- Adiciona a coluna EAN ao catálogo de produtos
ALTER TABLE product_catalog 
ADD COLUMN ean VARCHAR(50) DEFAULT NULL;

-- Cria um índice para otimizar as buscas por código de barras dentro de um grupo
CREATE INDEX idx_product_catalog_ean ON product_catalog(group_id, ean);

-- Opcional: Adicionar um comentário na coluna para documentação do schema
COMMENT ON COLUMN product_catalog.ean IS 'Código de barras EAN-13 ou UPC do produto. Usado para auto-preenchimento via scanner.';

```

### 2.2. Tipagem (`inventory.types.ts`)

Atualizar as tipagens do Supabase para refletir o novo campo `ean?: string | null` no `ProductCatalog`.

---

## 3. Camada de Dados e Integração API (`src/lib/webData.ts`)

O fluxo de busca deve ocorrer em "Cascata" para economizar requisições e garantir velocidade.

### 3.1. Método de Busca (Cascata)

Criar uma nova função no serviço de dados para encapsular a lógica de descoberta:

```typescript
// src/lib/barcodeService.ts ou dentro de webData.ts

export interface BarcodeResult {
  found: boolean;
  source: 'supabase' | 'openfoodfacts' | 'none';
  name?: string;
  ean: string;
}

export async function resolveProductByEan(ean: string, groupId: string | null): Promise<BarcodeResult> {
  // 1. Busca Interna (Supabase product_catalog)
  const { data: localProduct } = await supabase
    .from('product_catalog')
    .select('nome')
    .eq('ean', ean)
    .eq('group_id', groupId ?? 'personal')
    .single();

  if (localProduct) {
    return { found: true, source: 'supabase', name: localProduct.nome, ean };
  }

  // 2. Busca Externa (OpenFoodFacts - Gratuito e sem CORS issue)
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);
    const data = await response.json();

    if (data.status === 1 && data.product?.product_name) {
       // Opcional: concatenar marca se existir (ex: "Molho de Tomate - Heinz")
       const fullName = data.product.brands 
          ? `${data.product.product_name} - ${data.product.brands}`
          : data.product.product_name;

       return { found: true, source: 'openfoodfacts', name: fullName, ean };
    }
  } catch (error) {
    console.warn("Erro ao consultar OpenFoodFacts:", error);
  }

  // 3. Fallback: Não encontrado
  return { found: false, source: 'none', ean };
}

```

---

## 4. Componente UI: `<BarcodeScannerModal />`

Como o app usa daisyUI, o leitor de código de barras deve ser envelopado em um Modal (`<dialog>`) genérico que pode ser invocado de qualquer página.

* **Biblioteca Recomendada:** `html5-qrcode` (leve e suporta bem câmeras mobile web).
* **Comportamento:**
* Pede permissão de câmera apenas quando o modal for aberto.
* Fecha a câmera automaticamente (para poupar bateria) ao desmontar o componente ou ao detectar um código válido com sucesso.
* Emite um evento `onScan(ean: string)` para a página pai lidar com a regra de negócio.



---

## 5. Fluxos de UX e Integração nas Páginas

### 5.1. Lista de Compras (`ListPageNew.tsx`)

**Objetivo:** Alimentar o "Input Inteligente" (`Nome, quantidade, valor`) de forma mágica.

* **UI:** Adicionar um botão de Ícone de Câmera (`📸`) ao lado do `<Input />` de adição rápida.
* **Fluxo de Sucesso:**
1. Usuário clica na câmera e lê o código de um Sachê de Molho de Tomate.
2. O app chama `resolveProductByEan()`.
3. Retorna: `"Molho de Tomate Heinz"`.
4. O componente injeta o texto no input: `Molho de Tomate Heinz, 1`.
5. O usuário visualiza o chip dinâmico criado pelo seu parser e aperta `Enter` (ou adiciona o valor: `Molho de Tomate Heinz, 1, 3.50`).


* **Fluxo Fallback (Não Encontrado):**
1. Lê o código. A API e o Supabase não conhecem.
2. O modal fecha.
3. Dispara um Toast (via componente `<Toast />`): *"Código não reconhecido. Digite o nome para o sistema aprender!"*
4. O input fica focado e vazio.
5. Quando o usuário salvar esse item, a função de persistência deve enviar o `ean` lido junto com os dados para salvar no `product_catalog`.



### 5.2. Sessão de Estoque / Inventário (`StockPageNew.tsx`)

**Objetivo:** Agilizar a auditoria do que já está na despensa (dar baixa ou ajustar quantidade).

* **UI:** Adicionar um FAB (Floating Action Button) de "Auditoria Rápida" na tela de estoque.
* **Fluxo:**
1. Câmera abre em **Modo Contínuo** (não fecha após ler o 1º item).
2. Lê o código.
3. Consulta a cascata `resolveProductByEan()`.
4. O componente acessa o estado do Zustand (`useStockStore((s) => s.items)`).
5. **Se o item já existe no estoque atual (match pelo nome ou EAN):**
* Toca um feedback háptico (vibração leve via JS `navigator.vibrate(100)`).
* Dispara o estado que abre a **Bottom Sheet** do produto (`openProductDetails(itemId)`), focando na aba de ajuste de quantidade.


6. **Se o item não está no estoque atual:**
* Pausa o scanner temporariamente.
* Mostra um Modal/Toast interativo: *"Este item não está no seu estoque atual. Deseja adicionar uma entrada?"*.
* Se Sim -> Abre o `<ProductFormModal />` pré-preenchido. Se Não -> Retoma a leitura da câmera.





---

## 6. Tratamento de Exceções e Edge Cases

1. **Permissão de Câmera Negada:**
* Exibir um `<Alert type="warning">` dentro do modal de scanner informando: *"Precisamos de acesso à câmera para ler os códigos. Verifique as configurações do seu navegador."*


2. **Ambientes sem HTTPS:**
* Câmeras HTML5 só funcionam em contextos seguros (`https://` ou `localhost`). O botão de scanner deve ser **escondido (render condicional)** caso `window.isSecureContext` seja `false` para evitar botões quebrados em deploys mal configurados.


3. **Variação de Embalagens (Unidade Composta):**
* O EAN do pacote de papel higiênico com 4 rolos é diferente do EAN do pacote com 12 rolos. Se o app buscar na API e retornar "Papel Higiênico Neve 12 Rolos", o parser de input da lista de compras cuidará disso de forma orgânica, exigindo que o usuário só decida a quantidade do "pack".



---

## 7. Impactos na Arquitetura (Resumo)

| Camada | Arquivo Impactado | Ação |
| --- | --- | --- |
| **Database** | `supabase/migrations/...` | Adicionar coluna `ean` e index. |
| **Domain/Data** | `src/lib/webData.ts` | Criar fetcher `resolveProductByEan`. |
| **UI Components** | `src/components/Scanner/...` | Novo componente de modal genérico. |
| **Pages** | `src/pages/ListPageNew.tsx` | Botão câmera + injetar texto no parser. |
| **Pages** | `src/pages/StockPageNew.tsx` | Modo auditoria + gatilho da Bottom Sheet. |
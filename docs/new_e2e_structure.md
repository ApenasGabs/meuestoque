Você tem toda razão em questionar a orientação a objetos (OO) nesse contexto. Frameworks modernos como Playwright e Cypress brilham muito mais com abordagens funcionais. O excesso de classes, instâncias (`new Class()`) e o estado mutável do `this` frequentemente deixam os testes mais verbosos e difíceis de debugar.

Além disso, a sugestão da outra IA cometeu um pecado capital em relação ao que você queria: ela usou fluxos de UI (`ProductFlow`) dentro do construtor de estado (`StockBuilder`). Isso significa que o setup do teste continuaria clicando na tela para preparar os dados, matando a performance.

Vamos unir o melhor dos dois mundos: a **componentização e fluxos** (da outra IA) com a **injeção direta de estado no Supabase** (do meu doc), tudo envelopado em **Programação Funcional**.

Aqui está o documento refatorado e pronto para uso:

***

# Guia de Arquitetura E2E: Funcional e Orientada a Estado

Este documento define a arquitetura dos testes End-to-End (E2E) do "Meu Estoque". Utilizamos **Programação Funcional** (funções puras e composição) para garantir que os testes sejam previsíveis, fáceis de ler e livres de efeitos colaterais atrelados ao `this`.

## 1. Princípios Fundamentais

* **Setup via Backend, Validação via Frontend:** O estado inicial de um teste (ex: ter produtos no estoque) deve ser gerado injetando dados direto no Supabase. A UI só é usada para validar a funcionalidade alvo.
* **Funções em vez de Classes:** Abandonamos o *Page Object Model (POM)* clássico baseado em classes. Utilizamos funções exportadas que recebem o objeto `page` como argumento.
* **Separação Estrita:** UI (`screens`, `flows`) não se mistura com Banco de Dados (`state`).

---

## 2. Estrutura de Diretórios

```text
tests/e2e/
├── fixtures/           # Dados estáticos (usuários, payloads mockados)
├── screens/            # Ações atômicas de UI (antigo Page Objects, agora funcional)
├── flows/              # Composições de ações de UI (ex: preencher um form inteiro)
├── state/              # Funções de injeção direta no Supabase (Setup de ambiente)
└── scenarios/          # Os testes (specs)
```

---

## 3. Implementação Funcional

### 3.1. Screens (Ações Atômicas de UI)
Em vez de instanciar classes, exportamos funções puras que recebem o contexto do Playwright (`page`).

```typescript
// screens/stock.screen.ts
import { Page, expect } from '@playwright/test';

export const navigateToStock = async (page: Page) => {
  await page.goto('/estoque');
};

export const verifyProductVisible = async (page: Page, productName: string) => {
  const productLocator = page.locator(`[data-testid="product-row"]:has-text("${productName}")`);
  await expect(productLocator).toBeVisible();
};

export const updateProductQuantity = async (page: Page, productName: string, newQuantity: number) => {
  const row = page.locator(`[data-testid="product-row"]:has-text("${productName}")`);
  await row.locator('input[name="quantity"]').fill(newQuantity.toString());
  await row.locator('[data-testid="save-btn"]').click();
};
```

### 3.2. State (Setup Rápido no Supabase)
Aqui substituímos o `Builder` da outra IA por funções que inserem os dados direto no banco, ignorando a interface.

```typescript
// state/stock.state.ts
import { supabase } from '../../config/supabaseClient';

// Cria o estado exato necessário para a tela de estoque funcionar, em milissegundos
export const seedStockWithProducts = async (userId: string, productNames: string[]) => {
  // 1. Cria uma lista finalizada programaticamente
  const { data: list } = await supabase
    .from('shopping_lists')
    .insert({ user_id: userId, status: 'completed', name: 'Lista de Setup' })
    .select()
    .single();

  // 2. Mapeia e insere os produtos
  const itemsToInsert = productNames.map(name => ({
    list_id: list.id,
    user_id: userId,
    name,
    quantity: 1
  }));

  await supabase.from('inventory_items').insert(itemsToInsert);
  
  return list;
};

export const cleanupUserStock = async (userId: string) => {
  await supabase.from('shopping_lists').delete().eq('user_id', userId);
};
```

### 3.3. Flows (Composição de UI - Opcional)
Utilizados apenas quando você *realmente* precisa testar uma jornada longa na tela (ex: um teste focado no fluxo de criação).

```typescript
// flows/creation.flow.ts
import { Page } from '@playwright/test';
import * as ListScreen from '../screens/list.screen';

export const createAndFinalizeListFlow = async (page: Page, products: string[]) => {
  await ListScreen.navigateToListCreation(page);
  await ListScreen.fillListName(page, 'Compra do Mês');
  
  for (const product of products) {
    await ListScreen.addProduct(page, product);
  }
  
  await ListScreen.clickFinalize(page);
};
```

### 3.4. Cenários (A união das peças)
O cenário fica extremamente limpo e declarativo.

```typescript
// scenarios/stock.spec.ts
import { test } from '@playwright/test';
import * as StockScreen from '../screens/stock.screen';
import { seedStockWithProducts, cleanupUserStock } from '../state/stock.state';

test.describe('Estoque - Validações', () => {
  const TEST_USER_ID = 'user-uuid-123';

  test.afterEach(async () => {
    // Limpeza garantida após cada teste
    await cleanupUserStock(TEST_USER_ID);
  });

  test('Deve exibir produtos no estoque provenientes de uma lista finalizada', async ({ page }) => {
    // 1. SETUP: Injeta o estado direto no banco (Rápido, sem UI)
    await seedStockWithProducts(TEST_USER_ID, ['Arroz', 'Feijão']);

    // 2. ACT: Interage com a tela alvo
    await StockScreen.navigateToStock(page);

    // 3. ASSERT: Validações funcionais
    await StockScreen.verifyProductVisible(page, 'Arroz');
    await StockScreen.verifyProductVisible(page, 'Feijão');
  });
});
```

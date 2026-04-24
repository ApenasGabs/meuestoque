# 🔧 GUIA DE CORREÇÕES - DETALHES TÉCNICOS

---

## 📍 CORREÇÃO 1: Trigger para Tabela `items`

### Localização
```
📁 supabase/migrations/20260423_01_phase_a_v2.sql
   └─ Seção 8: Triggers (linhas 193-226)
```

### O Problema

A tabela `items` tem 2 colunas para rastrear atualização:
- Coluna **NOVA**: `atualizado_em` (adicionada pela migration)
- Coluna **INEXISTENTE**: `updated_at` (que o trigger tentava usar)

**O trigger genérico não funcionava porque a coluna não existe!**

### A Solução

**ANTES (❌ não funciona):**
```sql
-- Função genérica usada para TODAS as tabelas
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();  -- ❌ Não existe em 'items'!
  return new;
end;
$$;

-- Trigger usa a função genérica
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at();  -- ❌ Problema aqui
```

**DEPOIS (✅ funciona):**
```sql
-- Função genérica (continua igual para outras tabelas)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();  -- ✅ Funciona com stock_items e product_catalog
  return new;
end;
$$;

-- ✨ NOVA FUNÇÃO ESPECÍFICA para items
create or replace function public.set_updated_at_items()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();  -- ✅ Atualiza a coluna correta!
  return new;
end;
$$;

-- Trigger usa a função CORRETA
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at_items();  -- ✅ Usa a função específica
```

### Por Que Isso?

A migration foi **inconsistente**:
- Adicionou `atualizado_em` em `items`
- Mas adicionou `updated_at` em `stock_items` e `product_catalog`

Solução: criar função específica que conhece o nome da coluna em `items`.

### Verificação no Banco

Para verificar if a correção está aplicada:
```sql
-- Ver triggers da tabela
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'items';

-- Deverá mostrar:
-- trg_items_updated_at | UPDATE | execute function public.set_updated_at_items()
```

---

## 📍 CORREÇÃO 2: Coluna `quantidade_atual` no UPSERT

### Localização
```
📁 src/lib/webData.ts
   └─ Função upsertStockItem() (linha 847-875)
```

### O Problema

A migration adicionou:
```sql
alter table public.stock_items
  add column if not exists quantidade_atual numeric(12,4);
  
-- E depois tornou obrigatória:
alter table public.stock_items
  alter column quantidade_atual set not null;
```

**MAS** o código TypeScript não estava passando esse valor:

```typescript
// ❌ ANTES: Payload faltando a coluna NOT NULL
const payload = {
  id: input.id,
  group_id: input.groupId,
  nome: normalizeStockText(input.nome),
  categoria: normalizeStockCategory(input.categoria),
  unidade: normalizeStockText(input.unidade),
  quantidade: toPositiveNumber(input.quantidade),
  // ⚠️ FALTA quantidade_atual!
  quantidade_minima: toPositiveNumber(input.quantidadeMinima),
  tamanho_porcao: Math.max(1, toPositiveNumber(input.tamanhoPorcao, 1)),
  auto_adicionar_lista: input.autoAdicionarLista,
  consumo_frequencia: input.consumoFrequencia,
  consumo_valor: toPositiveNumber(input.consumoValor),
  data_compra: input.dataCompra ?? null,
  data_validade: input.dataValidade ?? null,
};
```

### A Solução

```typescript
// ✅ DEPOIS: Payload com quantidade_atual
const payload = {
  id: input.id,
  group_id: input.groupId,
  nome: normalizeStockText(input.nome),
  categoria: normalizeStockCategory(input.categoria),
  unidade: normalizeStockText(input.unidade),
  quantidade: toPositiveNumber(input.quantidade),
  quantidade_atual: toPositiveNumber(input.quantidade),  // ✨ ADICIONADO!
  quantidade_minima: toPositiveNumber(input.quantidadeMinima),
  tamanho_porcao: Math.max(1, toPositiveNumber(input.tamanhoPorcao, 1)),
  auto_adicionar_lista: input.autoAdicionarLista,
  consumo_frequencia: input.consumoFrequencia,
  consumo_valor: toPositiveNumber(input.consumoValor),
  data_compra: input.dataCompra ?? null,
  data_validade: input.dataValidade ?? null,
};
```

### Por Que Sincronizar?

Quando adicionar uma coluna NOT NULL ao banco:
1. ✅ Adicione DEFAULT ou UPDATE tudo que existe
2. ✅ Também ATUALIZE o código que insere novos rows
3. ✅ Senão = constraint violation quando inserir

**Regra:** Se coluna é NOT NULL, SEMPRE deve ter valor no INSERT/UPSERT.

---

## 🔄 Fluxo de Execução - Antes vs Depois

### ❌ ANTES: Erro ao Adicionar Item à Lista

```sql
-- Frontend envia:
INSERT INTO items (list_id, nome, quantidade, categoria, preco, comprado)
VALUES ('uuid-list', 'Leite', '2 L', 'Bebidas', NULL, false)

-- Trigger ativa (BEFORE INSERT):
EXECUTE TRIGGER trg_items_updated_at
  ├─ Chama: set_updated_at()
  └─ TENTA: new.updated_at = now()
      └─ ❌ ERRO: undefined column "updated_at"
         └─ Transaction rolls back
            └─ Frontend recebe erro 500
```

### ✅ DEPOIS: Item Adicionado com Sucesso

```sql
-- Frontend envia:
INSERT INTO items (list_id, nome, quantidade, categoria, preco, comprado)
VALUES ('uuid-list', 'Leite', '2 L', 'Bebidas', NULL, false)

-- Trigger ativa (BEFORE INSERT):
EXECUTE TRIGGER trg_items_updated_at
  ├─ Chama: set_updated_at_items()
  └─ EXECUTA: new.atualizado_em = now()  ✅
     └─ Coluna existe e é atualizada
        └─ Row inserido com sucesso
           └─ Frontend recebe data nova
```

---

### ❌ ANTES: Erro ao Adicionar Item ao Estoque

```sql
-- Frontend envia:
INSERT INTO stock_items (id, group_id, nome, quantidade, unidade, ...)
VALUES ('uuid', 'uuid', 'Arroz', 5, 'kg', ...)
-- ⚠️ Note: quantidade_atual NÃO incluído!

-- Banco verifica constraints:
CHECK NOT NULL on quantidade_atual
  ├─ quantidade_atual = NULL (não foi passado)
  └─ ❌ ERRO 23502: NOT NULL constraint violated
     └─ Transaction rolls back
        └─ Frontend recebe erro 500
```

### ✅ DEPOIS: Item Adicionado ao Estoque com Sucesso

```sql
-- Frontend envia:
INSERT INTO stock_items (id, group_id, nome, quantidade, quantidade_atual, unidade, ...)
VALUES ('uuid', 'uuid', 'Arroz', 5, 5, 'kg', ...)
-- ✅ Note: quantidade_atual = 5 (incluído!)

-- Banco verifica constraints:
CHECK NOT NULL on quantidade_atual
  ├─ quantidade_atual = 5 (foi passado) ✅
  └─ Todas as constraints OK
     └─ Row inserido com sucesso
        └─ Frontend recebe data nova
```

---

## 📊 Checklist de Sincronização

Quando adicionar coluna NOT NULL ao banco, verificar:

- [ ] Migration que adiciona a coluna
- [ ] Migration que torna NOT NULL (se separada)
- [ ] Migration que adiciona DEFAULT (se necessário)
- [ ] TypeScript: tipo/interface define a propriedade
- [ ] TypeScript: função que cria o payload passa o valor
- [ ] TypeScript: SELECT query inclui a coluna
- [ ] Testes: adicionar objeto funciona
- [ ] Testes: atualizar objeto funciona

---

## 🧪 Como Verificar as Correções

### No Banco de Dados (Supabase)

```sql
-- Verificar triggers de items
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'items';

-- Resultado esperado:
-- trigger_name: trg_items_updated_at
-- action_statement: execute function public.set_updated_at_items()

-- Verificar coluna quantidade_atual
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stock_items' AND column_name = 'quantidade_atual';

-- Resultado esperado:
-- column_name: quantidade_atual
-- data_type: numeric
-- is_nullable: NO
```

### No Navegador (Aplicação)

```javascript
// Abrir DevTools (F12) e ir em Console

// Teste 1: Adicionar item à lista
// Não deve haver erro: "field does not exist" ou "updated_at"

// Teste 2: Adicionar item ao estoque
// Não deve haver erro: "23502" ou "quantidade_atual"

// Logs esperados:
// ✅ POST /rest/v1/items (201 Created)
// ✅ POST /rest/v1/stock_items (201 Created)
```

---

## 📝 Notas de Implementação

### Arquivo 1: Migration
```
- Tipo: SQL DDL (Data Definition Language)
- Quando executa: Ao fazer push para Supabase
- Reversível: Sim, com migration revert (mas com dados)
- Ambiente: Production-ready (Phase A V2)
```

### Arquivo 2: TypeScript
```
- Tipo: TypeScript/JavaScript
- Quando executa: Ao salvar arquivo (rebuild automático)
- Reversível: Sim, com git revert
- Ambiente: Aplicação browser
```

---

## 🚀 Resumo Executivo

| Aspecto | Detalhes |
|---------|----------|
| **Problema 1** | Trigger tentava atualizar coluna inexistente |
| **Solução 1** | Criar função específica com nome correto |
| **Arquivos 1** | `supabase/migrations/20260423_01_phase_a_v2.sql` |
| **Problema 2** | UPSERT não passava valor para coluna NOT NULL |
| **Solução 2** | Adicionar `quantidade_atual` ao payload do UPSERT |
| **Arquivos 2** | `src/lib/webData.ts` |
| **Resultado** | ✅ Ambos os erros corrigidos e validados |

---

**Criado em:** 23 de Abril de 2026  
**Status:** ✅ Pronto para Produção


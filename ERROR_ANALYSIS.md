# 🔍 Análise Detalhada de Erros - Meuestoque

**Data:** 23 de Abril de 2026  
**Aplicação:** Meuestoque - Inventory Management System

---

## 📋 Sumário Executivo

O projeto possui **2 erros críticos** causados por inconsistências entre:
- Nomes de colunas nas migrations
- Triggers de `updated_at`
- Payloads de inserção/atualização

Ambos os erros precisam ser corrigidos **antes** de usar a feature de "Phase A V2".

---

## ❌ ERRO 1: Ao Adding Items to Shopping List

### Erro Reportado
```
record "new" has no field "updated_at"
```

### Stack Trace Esperado
```
Error at supabase.from("items").insert({...})
→ Trigger: trg_items_updated_at fires
→ Function: set_updated_at() executes
→ NEW.updated_at = now() ← PROBLEMA: Campo não existe!
```

### Raiz do Problema

**Arquivo:** `/supabase/migrations/20260423_01_phase_a_v2.sql` (Linhas 96-100)

A migração **ADICIONA** coluna `atualizado_em`:
```sql
alter table public.items
  add column if not exists atualizado_em timestamptz not null default now();
```

MAS o trigger (Linhas 220-226) tenta atualizar `updated_at`:
```sql
drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at();  -- ← Esta função SET updated_at
```

**Função `set_updated_at()`** (Linhas 193-200):
```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();  -- ← ERRO: Coluna não existe em "items"!
  return new;
end;
$$;
```

### Impacto
- ❌ Impossível adicionar itens à lista
- ❌ Impossível atualizar itens existentes
- ❌ Qualquer operação UPDATE na tabela `items` falha

### Solução Necessária
Mudar o trigger da tabela `items` para atualizar `atualizado_em` em vez de `updated_at`:

```sql
-- Criar trigger específico para items que usa atualizado_em
drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at_items();

-- Criar função específica
create or replace function public.set_updated_at_items()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
```

---

## ❌ ERRO 2: Ao Adding Items to Stock

### Erro Reportado
```json
{
    "code": "23502",
    "details": null,
    "hint": null,
    "message": "null value in column \"quantidade_atual\" of relation \"stock_items\" violates not-null constraint"
}
```

Error Code Explanation:
- `23502` = "integrity constraint violation - not null violation"

### Raiz do Problema

**Arquivo:** `/supabase/migrations/20260423_01_phase_a_v2.sql` (Linhas 105-113)

A migração **ADICIONA** coluna `quantidade_atual` como NOT NULL:
```sql
alter table public.stock_items
  add column if not exists quantidade_atual numeric(12,4),
  ...
update public.stock_items
set quantidade_atual = quantidade
where quantidade_atual is null;

alter table public.stock_items
  alter column quantidade_atual set not null;
```

MAS **NÃO DEFINE DEFAULT VALUE** para inserções futuras.

**Arquivo:** `/src/lib/webData.ts` (Linhas 847-865)

O UPSERT **NÃO INCLUI** `quantidade_atual`:
```typescript
export const upsertStockItem = async (input: UpsertStockItemInput): Promise<StockItemRecord> => {
  const payload = {
    id: input.id,
    group_id: input.groupId,
    nome: normalizeStockText(input.nome),
    categoria: normalizeStockCategory(input.categoria),
    unidade: normalizeStockText(input.unidade),
    quantidade: toPositiveNumber(input.quantidade),  // ← Campo "antigo"
    quantidade_minima: toPositiveNumber(input.quantidadeMinima),
    // ❌ FALTA: quantidade_atual: toPositiveNumber(input.quantidade),
    tamanho_porcao: Math.max(1, toPositiveNumber(input.tamanhoPorcao, 1)),
    auto_adicionar_lista: input.autoAdicionarLista,
    consumo_frequencia: input.consumoFrequencia,
    consumo_valor: toPositiveNumber(input.consumoValor),
    data_compra: input.dataCompra ?? null,
    data_validade: input.dataValidade ?? null,
  };
  
  const { data, error } = await supabase
    .from("stock_items")
    .upsert(payload)  // ← UPSERT SEM quantidade_atual
    .select(...)
    .maybeSingle();
```

### Fluxo de Erro

```
1. User adiciona item ao estoque
   ↓
2. upsertStockItem() chamado
   ↓
3. Payload criado SEM quantidade_atual
   ↓
4. UPSERT sentenciado ao Supabase
   ↓
5. INSERT: quantidade_atual = NULL (não fornecido)
   ↓
6. NOT NULL constraint violation! ❌
```

### Impacto
- ❌ Impossível criar novo item de estoque
- ❌ Impossível atualizar item de estoque existente via UPSERT
- ✅ Atualizações que não usam UPSERT podem funcionar

### Solução Necessária
Adicionar `quantidade_atual` ao payload do UPSERT:

```typescript
const payload = {
  // ... campos existentes ...
  quantidade_atual: toPositiveNumber(input.quantidade),  // ← ADICIONAR ESTA LINHA
  // ... resto dos campos ...
};
```

---

## 📊 Tabela Comparativa de Erros

| Aspecto | Erro 1: Shopping List | Erro 2: Stock Items |
|--------|----------------------|-------------------|
| **Tabela** | `items` | `stock_items` |
| **Operação** | INSERT/UPDATE | UPSERT |
| **Tipo de Erro** | Field does not exist | NOT NULL constraint |
| **Código SQL** | - | 23502 |
| **Local** | Migration: trigger | Código TypeScript |
| **Coluna Problemática** | `updated_at` vs `atualizado_em` | `quantidade_atual` |
| **Severidade** | 🔴 CRÍTICA | 🔴 CRÍTICA |

---

## ✅ Plano de Correção

### Fase 1: Corrigir Migration
**Arquivo:** `/supabase/migrations/20260423_01_phase_a_v2.sql`

1. Criar função específica `set_updated_at_items()` que atualiza `atualizado_em`:
   ```sql
   create or replace function public.set_updated_at_items()
   returns trigger language plpgsql as $$
   begin
     new.atualizado_em = now();
     return new;
   end;
   $$;
   ```

2. Atualizar trigger `trg_items_updated_at` para usar a nova função

### Fase 2: Corrigir TypeScript
**Arquivo:** `/src/lib/webData.ts` (Linha ~858)

Adicionar `quantidade_atual` ao payload:
```typescript
const payload = {
  // ... campos existentes ...
  quantidade: toPositiveNumber(input.quantidade),
  quantidade_atual: toPositiveNumber(input.quantidade),  // ← NOVA LINHA
  // ... resto ...
};
```

### Fase 3: Testar
1. Executar migrations no Supabase
2. Rodar app em dev
3. Testar:
   - ✅ Adicionar item à lista
   - ✅ Atualizar item da lista
   - ✅ Adicionar item ao estoque
   - ✅ Atualizar item do estoque

---

## 🔧 Comandos para Aplicar Migrations

```bash
# Ver status das migrations
npx supabase migration list

# Aplicar migrations (se estiverem pendentes)
npx supabase migration up

# Resetar (⚠️ PERDA DE DADOS - APENAS EM DEV)
npx supabase db reset
```

---

## 📝 Notas Adicionais

### Why These Issues Happened

1. **Inconsistência de Nomes:** `atualizado_em` foi adicionado, mas trigger genérico esperava `updated_at`
2. **Falta de Sincronização:** TypeScript payload não foi atualizado para incluir nova coluna NOT NULL
3. **Falta de DEFAULT:** Coluna `quantidade_atual` deveria ter DEFAULT para ser segura

### Best Practices para Evitar

- ✅ Sempre sincronizar triggers com nomes de colunas
- ✅ Adicionar DEFAULT para colunas NOT NULL (ex: `default 0`)
- ✅ Atualizar TypeScript payloads quando adicionar colunas NOT NULL
- ✅ Testar migrations em ambiente de staging antes de produção
- ✅ Documentar mudanças de schema em PRs

---


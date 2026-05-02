# Auditoria de Código vs. Schema — 02/05/2026

> **Contexto:** após mapear o schema real (`docs/database_map.md`) e gerar
> migrations de reconciliação (`docs/database_reconciliation_report_20260502.md`),
> esta auditoria mapeia onde o **código TypeScript** ainda referencia campos
> legados ou diverge da realidade do banco. Usar como roteiro de refator.
>
> Objetivo final: viabilizar a execução da migration
> `20260502_10_legacy_cleanup_disabled.sql` (drop de `quantidade_atual`,
> `stock_items.updated_at` e `stock_movements.item_id`).

---

## 🚨 Achado crítico — bloqueia migration 05

### `consume_stock_fifo` — assinatura no app NÃO bate com a migration

O código chama com **5 parâmetros** (`src/lib/webData.ts:1294-1301`):

```ts
await supabase.rpc("consume_stock_fifo", {
  p_stock_item_id: input.itemId,
  p_quantidade: quantity,
  p_tipo: input.tipo,            // ⚠️ parâmetro extra
  p_observacao: input.observacao ?? null,
  p_origem: input.origem ?? null,
  p_criado_por: input.createdBy ?? null,  // ⚠️ parâmetro extra
});
```

A migration `20260502_05_baseline_consume_stock_fifo.sql` que criei tem
**4 parâmetros** (sem `p_tipo` nem `p_criado_por`). Aplicar essa migration
sobrescreveria a função real e quebraria o consumo de estoque.

**Ação obrigatória antes de aplicar 20260502_05:**
1. Rodar `docs/precheck_queries_20260502.sql` (Bloco 2) para descobrir a
   assinatura e o corpo reais da função.
2. Reescrever `20260502_05_baseline_consume_stock_fifo.sql` para refletir
   exatamente a função em produção.
3. Só então aplicar.

> 💡 **Não aplique a migration 05 antes de fazer isso.** As outras
> migrations (01-04, 06-09) podem ser aplicadas com segurança.

---

## Inventário de referências a campos legados

### 1. `stock_items.quantidade_atual`

| Arquivo | Linha | Uso | Status |
|---|---|---|---|
| `src/lib/webData.ts` | 1139 | `quantidade_atual: toPositiveNumber(input.quantidade)` em `upsertStockItem` | 🔴 **Bloqueia drop** |
| `supabase/migrations/20260423_03_rpc_finalize_shopping_list.sql` | 168, 200 | INSERT e UPDATE | 🔴 **Bloqueia drop** |
| `supabase/migrations/20260423_04_fix_finalize_active_list_conflict.sql` | 165, 197 | INSERT e UPDATE | 🔴 **Bloqueia drop** |
| `supabase/migrations/20260425003437_fix_finalize_shopping_rpc.sql` | 165, 197 | INSERT e UPDATE | 🔴 **Bloqueia drop** |
| `supabase/migrations/20260501_bulk_expiration_feature.sql` | 179, 215 | INSERT e UPDATE | 🔴 **Bloqueia drop** |
| `docs/TESTING_GUIDE.md` | 18, 76, 83, 124 | Documentação histórica de bug | ℹ️ Apenas atualizar texto |

**Por que existe:** `stock_items.quantidade_atual` é `NOT NULL` (definido em
`20260423_01_phase_a_v2.sql:143`). Sem o `quantidade_atual` no INSERT, todo
upsert quebraria com `null value in column "quantidade_atual" violates
not-null constraint`.

**Refator necessário:**
1. Tornar a coluna nullable (já há trigger sincronizando `quantidade`):
   ```sql
   alter table public.stock_items alter column quantidade_atual drop not null;
   ```
2. Remover do INSERT em `webData.ts:1139`.
3. Remover dos INSERTs nas RPCs (criar `rpc_finalize_shopping_list` v3 sem o campo).
4. Validar via teste manual: criar item de estoque e verificar que `quantidade` é populado pela trigger.
5. Só então rodar `alter table ... drop column quantidade_atual`.

---

### 2. `stock_items.updated_at` (duplicado de `atualizado_em`)

| Arquivo | Uso |
|---|---|
| Banco | Trigger `trg_stock_items_updated_at` mantém o campo |
| `supabase/migrations/20260423_01_phase_a_v2.sql` | Cria a coluna NOT NULL DEFAULT now() |
| Código TS | **Nenhuma referência** encontrada (ver grep abaixo) |

**Status:** ✅ Drop seguro do ponto de vista de código TS, mas **a trigger
referencia o campo**.

**Refator necessário:**
1. Drop trigger `trg_stock_items_updated_at`:
   ```sql
   drop trigger if exists trg_stock_items_updated_at on public.stock_items;
   ```
2. Drop coluna:
   ```sql
   alter table public.stock_items drop column if exists updated_at;
   ```

`atualizado_em` continua sendo mantido pelo trigger
`trg_set_atualizado_em_stock_items`.

---

### 3. `stock_movements.item_id` (legado, duplicado de `stock_item_id`)

| Arquivo | Uso |
|---|---|
| `src/lib/webData.ts:929` | Tipo TypeScript (`item_id: string`) |
| `src/lib/webData.ts:1188` | SELECT lista o campo |
| `src/lib/webData.ts:1192` | OR `item_id.eq.${itemId},stock_item_id.eq.${itemId}` |
| `src/lib/webData.ts:1321` | INSERT preenche ambos |
| `src/lib/webData.ts:1373` | `.eq("item_id", itemId)` em `getStockConsumptionSummary` |
| Política RLS `stock_movements_all_v2` | `COALESCE(stock_item_id, item_id)` |
| Múltiplas RPCs | INSERT preenche ambos |

**Por que existe:** quando a Fase A introduziu `stock_item_id`, o código
manteve compatibilidade preenchendo os dois. A coluna velha tem
`FK ON DELETE CASCADE`, a nova tem `NO ACTION` — drop precisa preservar
esse comportamento (recriar FK em `stock_item_id` como CASCADE).

**Refator necessário:**
1. Garantir que **todos** os movements antigos têm `stock_item_id`
   preenchido (ver pre-check Bloco 7).
2. Substituir `webData.ts:1192` `or(...)` por simples `.eq("stock_item_id", itemId)`.
3. Substituir `webData.ts:1373` `.eq("item_id", ...)` por `.eq("stock_item_id", ...)`.
4. Remover `item_id` do `RecordStockMovementInput` (já é mesmo valor de `itemId`).
5. Remover `item_id` do tipo `StockMovementRecord` e da lista de SELECT.
6. Remover `item_id` dos INSERTs nas RPCs.
7. Atualizar política RLS para usar apenas `stock_item_id`:
   ```sql
   alter policy stock_movements_all_v2 on public.stock_movements
   using (
     exists (
       select 1 from public.stock_items si
       where si.id = stock_movements.stock_item_id
         and public.is_group_member(si.group_id)
     )
   )
   with check (
     exists (
       select 1 from public.stock_items si
       where si.id = stock_movements.stock_item_id
         and public.is_group_member(si.group_id)
     )
   );
   ```
8. Recriar FK de `stock_item_id` como CASCADE (ou aceitar NO ACTION):
   ```sql
   alter table public.stock_movements
     drop constraint if exists stock_movements_stock_item_id_fkey;
   alter table public.stock_movements
     add constraint stock_movements_stock_item_id_fkey
     foreign key (stock_item_id) references public.stock_items(id)
     on delete cascade;
   ```
9. Drop coluna:
   ```sql
   alter table public.stock_movements
     alter column stock_item_id set not null,
     drop column item_id;
   ```

---

## Outras divergências menores

### 4. `webData.ts:1281+ recordStockMovement` — fallback órfão

O código chama `consume_stock_fifo` para `saida`/`consumo_auto` e, em caso de
erro, **lança exception** (não há fallback). Mas o cálculo de `nextQuantity`
após a chamada (`Math.max(0, item.quantidade - quantity)`) é redundante:
o trigger `trg_sync_stock_item_quantity` já recalcula a partir dos lotes,
e nada usa `nextQuantity` no caminho FIFO.

**Limpeza recomendada (não-bloqueante):** remover linha 1310
(`nextQuantity = Math.max(0, item.quantidade - quantity);`) e variável
desnecessária.

### 5. `stockStore.ts:90-100` — atualização otimista de `quantidade`

O store atualiza `quantidade` localmente antes de chamar
`recordStockMovement`. Como a trigger de sync recalcula no banco, o valor
otimista pode ficar dessincronizado se houver lotes. Hoje funciona porque
o `getStockItems` é chamado depois e sobrescreve o estado.

**Status:** ✅ Funciona, mas é frágil. Considerar substituir update otimista
por loading state após adoção plena de `consume_stock_fifo`.

### 6. `webData.ts:233` — SELECT em `items` sem `quantidade_raw`

A query lista `quantidade` mas não `quantidade_raw`. A RPC finalize usa
`coalesce(i.quantidade_raw, i.quantidade)`, então hoje o app não consegue
exibir o texto original puro. Não bloqueia nada, mas pode confundir o
usuário ao editar item.

### 7. RPCs versionadas múltiplas vezes

Existem **três versões sucessivas** de `rpc_finalize_shopping_list`:
- `20260423_03_rpc_finalize_shopping_list.sql` (original)
- `20260423_04_fix_finalize_active_list_conflict.sql` (fix #1)
- `20260425003437_fix_finalize_shopping_rpc.sql` (fix #2)
- `20260501_bulk_expiration_feature.sql` (versão atual)

Como cada uma usa `CREATE OR REPLACE`, só a última prevalece. Mas o
diff entre elas dificulta auditoria.

**Recomendação (não-bloqueante):** quando for fazer o refator dos campos
legados, criar `rpc_finalize_shopping_list_v4` consolidada e marcar as
anteriores como históricas no comentário de cabeçalho.

---

## Plano de execução recomendado

### Fase 0 — Pre-checks (antes de aplicar QUALQUER migration nova)
- [ ] Rodar `docs/precheck_queries_20260502.sql` Bloco 1 (FK órfãos)
- [ ] Rodar Bloco 2 (assinatura `consume_stock_fifo`)
- [ ] Rodar Bloco 3 (corpo das outras funções drift)
- [ ] Rodar Blocos 4-8 para snapshot completo

### Fase 1 — Aplicar migrations seguras (01-04, 06-09)
- [ ] Aplicar `20260502_01_baseline_core_tables.sql`
- [ ] Aplicar `20260502_02_baseline_rate_limits.sql`
- [ ] Aplicar `20260502_03_baseline_group_rpcs.sql`
- [ ] Aplicar `20260502_04_baseline_stock_sync_triggers.sql`
- [ ] Aplicar `20260502_06_baseline_pack_columns.sql`
- [ ] Aplicar `20260502_07_fix_unit_conversion_column.sql`
- [ ] Aplicar `20260502_08_cleanup_duplicate_indexes_policies.sql`
- [ ] Aplicar `20260502_09_reapply_auth_user_fkeys.sql` (após resolver órfãos)

### Fase 2 — Reescrever 05 com base na realidade
- [ ] Editar `20260502_05_baseline_consume_stock_fifo.sql` com a assinatura real
- [ ] Aplicar

### Fase 3 — Refator do código (habilita 10)
- [ ] Tornar `quantidade_atual` nullable
- [ ] Remover `quantidade_atual` do `upsertStockItem`
- [ ] Criar `rpc_finalize_shopping_list_v4` sem `quantidade_atual`,
      `stock_items.updated_at` e `stock_movements.item_id`
- [ ] Atualizar `webData.ts` para parar de usar `item_id` em
      `getStockMovements` e `getStockConsumptionSummary`
- [ ] Atualizar `RecordStockMovementInput` e `StockMovementRecord`
- [ ] Atualizar política RLS `stock_movements_all_v2` para usar só `stock_item_id`

### Fase 4 — Drops finais (substituir migration 10)
- [ ] Drop trigger + coluna `stock_items.updated_at`
- [ ] Drop coluna `stock_items.quantidade_atual`
- [ ] Drop coluna `stock_movements.item_id` (após backfill se necessário)
- [ ] Recriar FK `stock_movements_stock_item_id_fkey` como CASCADE

### Fase 5 — Polimento (opcional)
- [ ] Adotar `consume_stock_fifo` no caminho de ajuste manual também
- [ ] UI de lotes em `StockItemDetailsPage`
- [ ] Catalog learning de validade no `productFormModal`
- [ ] Popular `product_unit_conversion` via `pack_size`/`pack_label`

---

## Resumo de risco

| Migration | Pode aplicar agora? | Bloqueio |
|---|---|---|
| 01 baseline_core_tables | ✅ Sim | — |
| 02 baseline_rate_limits | ✅ Sim | — |
| 03 baseline_group_rpcs | ✅ Sim | — |
| 04 baseline_stock_sync_triggers | ✅ Sim | — |
| **05 baseline_consume_stock_fifo** | ⛔ **NÃO** | Assinatura divergente do app — quebra consumo |
| 06 baseline_pack_columns | ✅ Sim | — |
| 07 fix_unit_conversion_column | ✅ Sim | — |
| 08 cleanup_duplicate_indexes_policies | ✅ Sim | — |
| 09 reapply_auth_user_fkeys | ⚠️ Sim, após pre-check de órfãos | Se houver órfãos, falha |
| 10 legacy_cleanup_disabled | ⛔ Já desabilitada | Aguarda Fase 3 do plano |

---

Gerado em **2026-05-02**.

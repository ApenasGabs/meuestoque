# Relatório de Reconciliação do Banco — 02/05/2026

> **Contexto:** após inspeção do banco real via MCP Supabase
> (ver `docs/supabase_inspection_results_20260502.md`) e comparação com
> `supabase/migrations/`, foi identificado drift significativo entre o
> schema vivo e o schema versionado. Este relatório documenta as
> migrations criadas em `supabase/migrations/20260502_*.sql` para
> reconciliar os dois lados.

---

## TL;DR

- **9 migrations** novas criadas (8 ativas + 1 documentada/no-op).
- **Todas idempotentes**: usam `IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP ... IF EXISTS` e blocos `DO $$` com checagem prévia. Podem ser
  aplicadas em qualquer ambiente sem efeitos colaterais.
- **Não há perda de dados** em nenhuma migration ativa.
- **Cleanup de campos legados** foi separado em arquivo desabilitado
  (`20260502_10_legacy_cleanup_disabled.sql`) porque o código ainda
  referencia esses campos.

---

## Inventário de migrations criadas

| # | Arquivo | Tema | Risco | Status |
|---|---|---|---|---|
| 01 | `20260502_01_baseline_core_tables.sql` | Baseline retroativo das 7 tabelas-base | Baixo | Ativa |
| 02 | `20260502_02_baseline_rate_limits.sql` | Baseline de `rate_limits` + RLS | Baixo | Ativa |
| 03 | `20260502_03_baseline_group_rpcs.sql` | `create_group`, `join_group_by_code` | Baixo | Ativa |
| 04 | `20260502_04_baseline_stock_sync_triggers.sql` | Triggers de sync `stock_lots` → `stock_items` | Médio | Ativa |
| 05 | `20260502_05_baseline_consume_stock_fifo.sql` | RPC de consumo FIFO | Baixo | Ativa |
| 06 | `20260502_06_baseline_pack_columns.sql` | `stock_items.pack_size` / `pack_label` | Baixo | Ativa |
| 07 | `20260502_07_fix_unit_conversion_column.sql` | Renomeia `fator_consumo_em_estoque` → `fator_consumo_padrao` | Médio | Ativa |
| 08 | `20260502_08_cleanup_duplicate_indexes_policies.sql` | Remove 3 índices e 1 política duplicados | Baixo | Ativa |
| 09 | `20260502_09_reapply_auth_user_fkeys.sql` | FKs `stock_lots.created_by`/`shopping_lists.fechado_por` → `auth.users` | Médio | Ativa |
| 10 | `20260502_10_legacy_cleanup_disabled.sql` | Drop de `quantidade_atual`, `updated_at`, `item_id` | **Alto** | **NO-OP** (documentação) |

---

## Detalhe por migration

### 01 — Baseline core tables
**O que faz:** versiona retroativamente as tabelas que existem em produção
mas nunca tiveram migration: `profiles`, `groups`, `group_members`,
`shopping_lists`, `items`, `stock_items`, `stock_movements`. Inclui
índices originais (`idx_stock_items_*`, `idx_stock_movements_*`).

**Por que importa:** sem isto, um `supabase db reset` (ou um novo
ambiente) quebra na primeira migration que faz `ALTER TABLE` (Fase A).

**Idempotência:** `CREATE TABLE IF NOT EXISTS` em tudo.

**Pontos de atenção:**
- Usa `unique (group_id, user_id)` em `group_members` (gera o constraint
  `group_members_group_id_user_id_key` observado no banco real).
- **Não** declara FK lógica `profiles.id → auth.users(id)` para evitar
  conflito com policies do Supabase Auth no bootstrap. O comentário
  inline explica como fortalecer essa FK manualmente.

---

### 02 — Baseline rate_limits
**O que faz:** cria `rate_limits` com índice composto e RLS habilitada
(apenas `INSERT` permitido para o próprio usuário).

**Por que importa:** documenta o comportamento intencional da tabela
(escrita por clientes, leitura/limpeza só por edge functions).

---

### 03 — Baseline group RPCs
**O que faz:** versiona `create_group(p_nome)` e `join_group_by_code(p_codigo)`.

**Por que importa:** essas RPCs são chamadas pelo app (fluxo de criação
e entrada em grupos). Sem versionamento, qualquer reset de schema
quebra esses fluxos.

**Implementação:**
- Ambas são `SECURITY DEFINER` com `set search_path = public`.
- `join_group_by_code` é tolerante a duplicidade
  (`on conflict (group_id, user_id) do nothing`).
- Validação de input com mensagem clara.

---

### 04 — Triggers de sync stock_lots → stock_items
**O que faz:** versiona 3 funções e 3 triggers que mantêm
automaticamente:
- `stock_items.quantidade = SUM(stock_lots.quantidade_restante)`
- `stock_items.data_validade = MIN(stock_lots.data_validade)` (apenas
  lotes com `quantidade_restante > 0`)
- `stock_items.atualizado_em = now()` em UPDATEs

**Por que importa (criticidade alta):** estes triggers são o **coração
do design "lotes + FIFO"**. Sem eles, o app perde a sincronia entre
estoque agregado e lotes físicos.

**Implementação:**
- `coalesce(new, old)` no trigger para suportar INSERT/UPDATE/DELETE.
- Filtro `quantidade_restante > 0` na função `sync_stock_item_validade`
  evita que lotes esgotados continuem influenciando a data exibida.
- Função `set_atualizado_em_stock_items` convive com o trigger
  `trg_stock_items_updated_at` (este último cuida do campo legado
  `updated_at`).

**Verificação pós-aplicação sugerida:**
```sql
-- Inserir lote de teste e ver se quantidade do item recalcula
insert into stock_lots (...) returning id;
select id, quantidade, data_validade from stock_items where id = '...';
```

---

### 05 — consume_stock_fifo
**O que faz:** versiona a RPC de consumo FIFO. Recebe
`(p_stock_item_id, p_quantidade, p_observacao, p_origem)`, consome
dos lotes em ordem (validade ASC NULLS LAST → data_compra ASC →
created_at ASC), gera `stock_movements (tipo='saida')` por lote
afetado, e retorna a quantidade efetivamente consumida.

**Por que importa:** o app pode passar a usar isso no consumo manual
e no auto-consumo, substituindo cálculos JS.

**Garantias de segurança:**
- `auth.uid()` obrigatório.
- `is_group_member(group_id)` verificado antes de qualquer escrita.
- `FOR UPDATE` nos lotes evita race conditions em múltiplos consumos
  simultâneos.

**Comportamento:**
- Se a quantidade pedida for maior que o estoque, consome o disponível
  e retorna o total consumido (não falha).
- Triggers de sync recalculam `stock_items.quantidade` e
  `data_validade` automaticamente após a execução.

---

### 06 — pack_size / pack_label
**O que faz:** adiciona `stock_items.pack_size numeric` e
`stock_items.pack_label text` (que existem no banco mas não em
nenhuma migration).

**Por que importa:** esses campos são a base para popular
`product_unit_conversion` (ex: "1 saco = 5 Kg") quando a UI evoluir.

---

### 07 — Fix product_unit_conversion column name
**O que faz:** reconcilia divergência onde a migration original
(`20260423_01_phase_a_v2.sql`) cria a coluna como
`fator_consumo_em_estoque`, mas no banco real ela existe como
`fator_consumo_padrao`.

**Lógica:**
1. Se só `fator_consumo_em_estoque` existe → renomeia.
2. Se ambas existem → dropa a antiga (`fator_consumo_em_estoque`).
3. Se nenhuma existe → cria `fator_consumo_padrao`.

**Risco médio:** caso (2) descarta uma coluna. Como hoje
`product_unit_conversion` tem **0 registros** no banco real (verificado
via inspeção), não há risco prático de perda de dados.

**Recomendação adicional:** considerar editar
`20260423_01_phase_a_v2.sql` futuramente para usar diretamente
`fator_consumo_padrao`, eliminando esta migration de correção. Não foi
feito agora para preservar o histórico de migrations já aplicadas.

---

### 08 — Cleanup de índices e políticas duplicadas
**O que faz:** remove estruturas que duplicam exatamente o que as
migrations da Fase A já criaram.

**Itens removidos:**
- Índice `idx_shopping_lists_active_group` (idêntico a
  `ux_shopping_lists_group_active`).
- Índice `idx_stock_items_group_product` (idêntico a
  `ux_stock_items_group_product`).
- Índice `idx_product_catalog_unique` (idêntico a
  `ux_product_catalog_group_nome_unidade`).
- Política RLS `"Acesso via produto"` em `product_unit_conversion`
  (idêntica a `product_unit_conversion_all`).

**Benefício:** menos overhead em INSERT/UPDATE (cada índice extra
custa); RLS mais simples de auditar.

---

### 09 — Reaplicar FKs para auth.users
**O que faz:** garante que `stock_lots.created_by` e
`shopping_lists.fechado_por` apontam para `auth.users(id)` com
`ON DELETE SET NULL`. A migration original
(`20260501100000_fix_fkey_auth_users.sql`) está versionada mas **não
foi aplicada** ao banco real (verificado em `information_schema`).

**Por que importa:** sem essas FKs, deletar um usuário do `auth.users`
deixa registros órfãos referenciando UUIDs inexistentes — pode
quebrar joins e relatórios.

**Risco médio:** se houver atualmente algum `created_by` /
`fechado_por` apontando para um `auth.users.id` que **não existe**, o
`ADD CONSTRAINT` falhará. Antes de aplicar em produção, rodar:

```sql
-- Detecta órfãos antes de aplicar
select count(*) from public.stock_lots sl
where sl.created_by is not null
  and not exists (select 1 from auth.users u where u.id = sl.created_by);

select count(*) from public.shopping_lists s
where s.fechado_por is not null
  and not exists (select 1 from auth.users u where u.id = s.fechado_por);
```

Se retornar > 0, executar primeiro:
```sql
update public.stock_lots set created_by = null
where created_by is not null
  and not exists (select 1 from auth.users u where u.id = created_by);

update public.shopping_lists set fechado_por = null
where fechado_por is not null
  and not exists (select 1 from auth.users u where u.id = fechado_por);
```

---

### 10 — Legacy cleanup (DESABILITADA)
**O que faz:** **NADA.** É um placeholder documentando os drops
desejados de campos legados.

**Por que está desabilitada:** `quantidade_atual`, `updated_at` (em
`stock_items`) e `item_id` (em `stock_movements`) ainda são
referenciados:
- `src/lib/webData.ts:1139` (`quantidade_atual` no INSERT)
- Múltiplas RPCs (`20260423_03`, `20260423_04`, `20260425003437`,
  `20260501_bulk_expiration_feature`)
- Política RLS `stock_movements_all_v2` usa
  `COALESCE(stock_item_id, item_id)`

**Sequência segura para ativar futuramente:**
1. Remover `quantidade_atual` de `src/lib/webData.ts`.
2. Atualizar todas as RPCs para parar de gravar `quantidade_atual`,
   `updated_at` (em `stock_items`) e `item_id` (em `stock_movements`).
3. Atualizar `stock_movements_all_v2` para usar apenas `stock_item_id`.
4. Substituir o NO-OP por DROPs reais.

---

## Como aplicar

### Em ambiente local (Supabase CLI)
```bash
supabase db push
```

### Em produção
Por ordem (já alinhada pelo nome dos arquivos):
1. Aplicar via CI/CD ou Supabase Dashboard.
2. Antes da #09, rodar a checagem de órfãos descrita acima.
3. Após aplicar todas, validar com:

```sql
-- Reexecutar as queries de inspeção do dia 02/05 e comparar
-- (ver docs/supabase_inspection_results_20260502.md)
```

---

## Checklist de validação pós-aplicação

- [ ] `information_schema.columns` mostra `pack_size`, `pack_label` em `stock_items`.
- [ ] `information_schema.routines` mostra `create_group`, `join_group_by_code`, `consume_stock_fifo`, `sync_stock_item_quantity`, `sync_stock_item_validade`, `set_atualizado_em_stock_items`.
- [ ] `information_schema.triggers` mostra `trg_sync_stock_item_quantity`, `trg_sync_stock_item_validade`, `trg_set_atualizado_em_stock_items`.
- [ ] `information_schema.table_constraints` mostra `stock_lots_created_by_fkey` e `shopping_lists_fechado_por_fkey` apontando para `auth.users`.
- [ ] `pg_indexes` **não** mostra mais `idx_shopping_lists_active_group`, `idx_stock_items_group_product`, `idx_product_catalog_unique`.
- [ ] `pg_policies` **não** mostra mais `"Acesso via produto"`.
- [ ] `product_unit_conversion` tem coluna `fator_consumo_padrao` (e não tem `fator_consumo_em_estoque`).
- [ ] Smoke test: criar grupo via UI, criar lista, comprar item, finalizar — verificar que estoque é incrementado e movimento é registrado.

---

## Próximos passos sugeridos (fora deste lote)

1. **Adotar `consume_stock_fifo` no app** — substituir lógica de consumo manual em `src/features/inventory/`.
2. **UI de lotes** — exibir `stock_lots` por item no `StockItemDetailsPage`.
3. **Catalog learning na UI** — usar `product_catalog.validade_padrao_dias` para sugerir validade no formulário de compra.
4. **Popular `product_unit_conversion`** — formulário no cadastro de produto que recebe `pack_size` + `pack_label` e cria a conversão.
5. **Habilitar `20260502_10`** — após completar passos 1–4 do cabeçalho daquele arquivo.

---

Gerado em **2026-05-02**.

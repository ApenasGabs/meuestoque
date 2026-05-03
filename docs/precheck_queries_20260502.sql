-- =====================================================================
-- Pre-checks de aplicação das migrations 20260502_*
-- Data: 2026-05-02
-- Como usar: rode bloco a bloco no Supabase SQL Editor (ou via MCP).
-- Não modifica dados. Apenas SELECTs de diagnóstico.
-- =====================================================================

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BLOCO 1 — Sanidade de FKs (pré-requisito para 20260502_09)         │
-- │                                                                     │
-- │ A migration 09 reaplica FKs em stock_lots.created_by e             │
-- │ shopping_lists.fechado_por apontando para auth.users(id).          │
-- │ Se houver órfãos, a migration falha. Estas queries detectam.       │
-- └─────────────────────────────────────────────────────────────────────┘

-- 1.1) Órfãos em stock_lots.created_by
select count(*) as orphans_stock_lots_created_by
from public.stock_lots sl
where sl.created_by is not null
  and not exists (select 1 from auth.users u where u.id = sl.created_by);

-- 1.2) Órfãos em shopping_lists.fechado_por
select count(*) as orphans_shopping_lists_fechado_por
from public.shopping_lists s
where s.fechado_por is not null
  and not exists (select 1 from auth.users u where u.id = s.fechado_por);

-- 1.3) (Bonus) Órfãos em outras colunas que apontam logicamente para auth.users
--      Estes não bloqueiam a migration 09, mas são bons de saber.
select 'group_members.user_id' as col, count(*) as orphans
from public.group_members gm
where gm.user_id is not null
  and not exists (select 1 from auth.users u where u.id = gm.user_id)
union all
select 'items.criado_por', count(*) from public.items i
where i.criado_por is not null
  and not exists (select 1 from auth.users u where u.id = i.criado_por)
union all
select 'stock_movements.criado_por', count(*) from public.stock_movements sm
where sm.criado_por is not null
  and not exists (select 1 from auth.users u where u.id = sm.criado_por)
union all
select 'rate_limits.user_id', count(*) from public.rate_limits rl
where not exists (select 1 from auth.users u where u.id = rl.user_id)
union all
select 'profiles.id', count(*) from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

-- Se 1.1 ou 1.2 retornarem > 0, rode esta limpeza ANTES de aplicar 09:
--
-- begin;
-- update public.stock_lots set created_by = null
-- where created_by is not null
--   and not exists (select 1 from auth.users u where u.id = created_by);
--
-- update public.shopping_lists set fechado_por = null
-- where fechado_por is not null
--   and not exists (select 1 from auth.users u where u.id = fechado_por);
-- commit;


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BLOCO 2 — Descobrir assinatura real de consume_stock_fifo          │
-- │                                                                     │
-- │ ⚠️ CRÍTICO: o app chama com 5 parâmetros (p_tipo, p_criado_por),   │
-- │ mas a migration que escrevi tem apenas 4. Precisamos saber qual    │
-- │ assinatura está realmente no banco antes de aplicar 20260502_05.   │
-- └─────────────────────────────────────────────────────────────────────┘

-- 2.1) Lista parâmetros da função real
select
  p.proname as function_name,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as returns
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'consume_stock_fifo';

-- 2.2) Mostra o corpo da função real (para podermos copiar exatamente
--      antes de "sobrescrever" com a migration 05)
select pg_get_functiondef(p.oid) as function_body
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'consume_stock_fifo';


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BLOCO 3 — Mesmo diagnóstico para outras funções "drift"            │
-- │ (precisamos garantir que nossas migrations não regridam o          │
-- │ comportamento atual em produção)                                    │
-- └─────────────────────────────────────────────────────────────────────┘

select
  p.proname as function_name,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as returns,
  pg_get_functiondef(p.oid) as body
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_group',
    'join_group_by_code',
    'sync_stock_item_quantity',
    'sync_stock_item_validade',
    'set_atualizado_em_stock_items'
  )
order by p.proname;


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BLOCO 4 — Conferir constraints CHECK ainda não documentadas        │
-- │ (ex: tipos válidos em stock_movements.tipo)                        │
-- └─────────────────────────────────────────────────────────────────────┘

select
  conrelid::regclass as table_name,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'c'
  and connamespace = 'public'::regnamespace
order by table_name, conname;


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BLOCO 5 — Snapshot rápido de RLS habilitada por tabela             │
-- └─────────────────────────────────────────────────────────────────────┘

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BLOCO 6 — Estado de coluna fator_consumo_em_estoque vs padrao      │
-- │ (a migration 07 lida com renomeação)                                │
-- └─────────────────────────────────────────────────────────────────────┘

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'product_unit_conversion'
  and column_name in ('fator_consumo_em_estoque', 'fator_consumo_padrao');

-- Conta de registros (se houver dados, renomear é mais sensível)
select count(*) as rows_in_product_unit_conversion
from public.product_unit_conversion;


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BLOCO 7 — Confirmar que nenhum item tem stock_movements órfãos     │
-- │ que dependem do campo legado item_id (relevante para o cleanup     │
-- │ futuro previsto na migration 10)                                    │
-- └─────────────────────────────────────────────────────────────────────┘

-- Movements onde item_id e stock_item_id divergem (deveriam ser sempre iguais)
select count(*) as movements_with_divergent_ids
from public.stock_movements
where stock_item_id is not null
  and item_id is not null
  and stock_item_id <> item_id;

-- Movements onde stock_item_id é NULL mas item_id não (legado puro)
select count(*) as movements_only_legacy_item_id
from public.stock_movements
where stock_item_id is null
  and item_id is not null;


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BLOCO 8 — Sanity: stock_items.quantidade vs SUM(lots.restante)     │
-- │ (caso os triggers de sync ainda não existissem em algum ambiente)  │
-- └─────────────────────────────────────────────────────────────────────┘

select
  si.id,
  si.nome,
  si.quantidade as recorded_qty,
  coalesce(sum(sl.quantidade_restante), 0) as sum_lots_qty,
  si.quantidade - coalesce(sum(sl.quantidade_restante), 0) as drift
from public.stock_items si
left join public.stock_lots sl on sl.stock_item_id = si.id
group by si.id, si.nome, si.quantidade
having abs(si.quantidade - coalesce(sum(sl.quantidade_restante), 0)) > 0.001
order by abs(si.quantidade - coalesce(sum(sl.quantidade_restante), 0)) desc
limit 50;

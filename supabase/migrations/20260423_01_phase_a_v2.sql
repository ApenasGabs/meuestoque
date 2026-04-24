-- Fase A (aditiva) - Supabase Data Model V2
-- Data: 2026-04-23
-- Objetivo: criar tabelas novas e colunas aditivas sem quebrar o fluxo atual.

begin;

create extension if not exists pgcrypto;

-- =====================================================
-- 1) Tabela nova: product_catalog
-- =====================================================
create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  nome text not null,
  categoria text not null default 'Outros',
  consumo_tags text[] not null default '{}',
  unidade_estoque text not null,
  unidade_tipo text not null check (unidade_tipo in ('simple', 'composite')),
  porcao_padrao numeric(12,4) not null default 1,
  unidade_porcao text not null default 'un',
  perecivel boolean not null default true,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_product_catalog_group_nome_unidade
  on public.product_catalog (group_id, lower(nome), unidade_estoque);

create index if not exists ix_product_catalog_group_id
  on public.product_catalog (group_id);

create index if not exists ix_product_catalog_consumo_tags_gin
  on public.product_catalog using gin (consumo_tags);

-- =====================================================
-- 2) Tabela nova: product_unit_conversion (template)
-- =====================================================
create table if not exists public.product_unit_conversion (
  product_id uuid primary key references public.product_catalog(id) on delete cascade,
  compra_quantidade numeric(12,4) not null check (compra_quantidade > 0),
  compra_unidade text not null,
  rendimento_quantidade numeric(12,4) not null check (rendimento_quantidade > 0),
  rendimento_unidade text not null,
  fator_consumo_em_estoque numeric(18,8) not null check (fator_consumo_em_estoque > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- 3) Evolução aditiva em shopping_lists
-- =====================================================
alter table public.shopping_lists
  add column if not exists status text,
  add column if not exists fechado_por uuid references public.profiles(id),
  add column if not exists finalized_at timestamptz,
  add column if not exists closed_purchase_date date;

update public.shopping_lists
set status = case
  when ativa = true then 'active'
  when finalizada_em is not null then 'closed'
  else 'archived'
end
where status is null;

alter table public.shopping_lists
  alter column status set default 'active';

alter table public.shopping_lists
  alter column status set not null;

-- Garante no máximo uma lista ativa por grupo antes do índice único parcial.
with ranked as (
  select
    id,
    group_id,
    row_number() over (
      partition by group_id
      order by coalesce(finalized_at, finalizada_em, now()) desc nulls last, id desc
    ) as rn
  from public.shopping_lists
  where status = 'active'
)
update public.shopping_lists s
set
  status = 'closed',
  ativa = false,
  finalizada_em = coalesce(s.finalizada_em, now()),
  finalized_at = coalesce(s.finalized_at, now())
from ranked r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists ux_shopping_lists_group_active
  on public.shopping_lists (group_id)
  where status = 'active';

alter table public.shopping_lists
  add constraint shopping_lists_status_chk
  check (status in ('active', 'closed', 'archived'));

-- =====================================================
-- 4) Evolução aditiva em items
-- =====================================================
alter table public.items
  add column if not exists product_id uuid references public.product_catalog(id),
  add column if not exists quantidade_num numeric(12,4),
  add column if not exists unidade text,
  add column if not exists quantidade_raw text,
  add column if not exists preco_total numeric(12,2),
  add column if not exists preco_unitario numeric(12,4),
  add column if not exists comprado_em timestamptz,
  add column if not exists atualizado_em timestamptz not null default now();

update public.items
set
  quantidade_raw = quantidade,
  preco_total = coalesce(preco_total, preco)
where quantidade_raw is null;

create index if not exists ix_items_list_id
  on public.items (list_id);

create index if not exists ix_items_product_id
  on public.items (product_id);

-- =====================================================
-- 5) Evolução aditiva em stock_items
-- =====================================================
alter table public.stock_items
  add column if not exists product_id uuid references public.product_catalog(id),
  add column if not exists quantidade_atual numeric(12,4),
  add column if not exists data_validade_alerta date,
  add column if not exists updated_at timestamptz not null default now();

update public.stock_items
set quantidade_atual = quantidade
where quantidade_atual is null;

alter table public.stock_items
  alter column quantidade_atual set not null;

create unique index if not exists ux_stock_items_group_product
  on public.stock_items (group_id, product_id)
  where product_id is not null;

-- =====================================================
-- 6) Tabela nova: stock_lots
-- =====================================================
create table if not exists public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  source_list_item_id uuid references public.items(id) on delete set null,
  quantidade_inicial numeric(12,4) not null check (quantidade_inicial >= 0),
  quantidade_restante numeric(12,4) not null check (quantidade_restante >= 0),
  unidade text not null,
  custo_total numeric(12,2) check (custo_total is null or custo_total >= 0),
  custo_unitario numeric(12,6) check (custo_unitario is null or custo_unitario >= 0),
  fator_consumo numeric(18,8) check (fator_consumo is null or fator_consumo > 0),
  data_compra date not null,
  data_validade date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists ix_stock_lots_stock_item_id
  on public.stock_lots (stock_item_id);

create index if not exists ix_stock_lots_validade
  on public.stock_lots (data_validade);

create index if not exists ix_stock_lots_compra
  on public.stock_lots (data_compra);

-- =====================================================
-- 7) Evolução aditiva em stock_movements
-- =====================================================
alter table public.stock_movements
  add column if not exists stock_item_id uuid references public.stock_items(id),
  add column if not exists lot_id uuid references public.stock_lots(id),
  add column if not exists unidade text,
  add column if not exists custo_unitario_ref numeric(12,6),
  add column if not exists origem text,
  add column if not exists source_list_id uuid references public.shopping_lists(id),
  add column if not exists source_list_item_id uuid references public.items(id);

update public.stock_movements
set stock_item_id = item_id
where stock_item_id is null;

update public.stock_movements sm
set unidade = si.unidade
from public.stock_items si
where sm.stock_item_id = si.id
  and sm.unidade is null;

create index if not exists ix_stock_movements_stock_item_id
  on public.stock_movements (stock_item_id);

create index if not exists ix_stock_movements_source_list_id
  on public.stock_movements (source_list_id);

-- =====================================================
-- 8) Trigger padrão de updated_at
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Função específica para items que usa atualizado_em
create or replace function public.set_updated_at_items()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_product_catalog_updated_at on public.product_catalog;
create trigger trg_product_catalog_updated_at
before update on public.product_catalog
for each row
execute function public.set_updated_at();

drop trigger if exists trg_product_unit_conversion_updated_at on public.product_unit_conversion;
create trigger trg_product_unit_conversion_updated_at
before update on public.product_unit_conversion
for each row
execute function public.set_updated_at();

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at_items();

drop trigger if exists trg_stock_items_updated_at on public.stock_items;
create trigger trg_stock_items_updated_at
before update on public.stock_items
for each row
execute function public.set_updated_at();

commit;

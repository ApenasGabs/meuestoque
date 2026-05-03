-- ====================================================================
-- Migration: 20260423000001_phase_a_v2.sql
-- ====================================================================
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


-- ====================================================================
-- Migration: 20260423000002_phase_a_v2_rls.sql
-- ====================================================================
-- Fase A (RLS) - Supabase Data Model V2
-- Data: 2026-04-23
-- Objetivo: habilitar RLS nas estruturas novas e reforçar performance de membership.

begin;

-- =====================================================
-- 1) Índice de performance para membership
-- =====================================================
create index if not exists ix_group_members_user_group
  on public.group_members (user_id, group_id);

-- =====================================================
-- 2) Helper function para RLS
-- =====================================================
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

-- =====================================================
-- 3) RLS em product_catalog
-- =====================================================
alter table public.product_catalog enable row level security;

drop policy if exists product_catalog_select on public.product_catalog;
create policy product_catalog_select
on public.product_catalog
for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists product_catalog_insert on public.product_catalog;
create policy product_catalog_insert
on public.product_catalog
for insert
to authenticated
with check (public.is_group_member(group_id));

drop policy if exists product_catalog_update on public.product_catalog;
create policy product_catalog_update
on public.product_catalog
for update
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

drop policy if exists product_catalog_delete on public.product_catalog;
create policy product_catalog_delete
on public.product_catalog
for delete
to authenticated
using (public.is_group_member(group_id));

-- =====================================================
-- 4) RLS em product_unit_conversion (via product_catalog)
-- =====================================================
alter table public.product_unit_conversion enable row level security;

drop policy if exists product_unit_conversion_all on public.product_unit_conversion;
create policy product_unit_conversion_all
on public.product_unit_conversion
for all
to authenticated
using (
  exists (
    select 1
    from public.product_catalog pc
    where pc.id = product_unit_conversion.product_id
      and public.is_group_member(pc.group_id)
  )
)
with check (
  exists (
    select 1
    from public.product_catalog pc
    where pc.id = product_unit_conversion.product_id
      and public.is_group_member(pc.group_id)
  )
);

-- =====================================================
-- 5) RLS em stock_lots (via stock_items)
-- =====================================================
alter table public.stock_lots enable row level security;

drop policy if exists stock_lots_all on public.stock_lots;
create policy stock_lots_all
on public.stock_lots
for all
to authenticated
using (
  exists (
    select 1
    from public.stock_items si
    where si.id = stock_lots.stock_item_id
      and public.is_group_member(si.group_id)
  )
)
with check (
  exists (
    select 1
    from public.stock_items si
    where si.id = stock_lots.stock_item_id
      and public.is_group_member(si.group_id)
  )
);

-- =====================================================
-- 6) Reforço de RLS em tabelas existentes (compatível)
-- =====================================================
alter table public.shopping_lists enable row level security;
alter table public.items enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;

-- shopping_lists

drop policy if exists shopping_lists_select_v2 on public.shopping_lists;
create policy shopping_lists_select_v2
on public.shopping_lists
for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists shopping_lists_insert_v2 on public.shopping_lists;
create policy shopping_lists_insert_v2
on public.shopping_lists
for insert
to authenticated
with check (public.is_group_member(group_id));

drop policy if exists shopping_lists_update_v2 on public.shopping_lists;
create policy shopping_lists_update_v2
on public.shopping_lists
for update
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

drop policy if exists shopping_lists_delete_v2 on public.shopping_lists;
create policy shopping_lists_delete_v2
on public.shopping_lists
for delete
to authenticated
using (public.is_group_member(group_id));

-- items

drop policy if exists items_all_v2 on public.items;
create policy items_all_v2
on public.items
for all
to authenticated
using (
  exists (
    select 1
    from public.shopping_lists sl
    where sl.id = items.list_id
      and public.is_group_member(sl.group_id)
  )
)
with check (
  exists (
    select 1
    from public.shopping_lists sl
    where sl.id = items.list_id
      and public.is_group_member(sl.group_id)
  )
);

-- stock_items

drop policy if exists stock_items_all_v2 on public.stock_items;
create policy stock_items_all_v2
on public.stock_items
for all
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

-- stock_movements

drop policy if exists stock_movements_all_v2 on public.stock_movements;
create policy stock_movements_all_v2
on public.stock_movements
for all
to authenticated
using (
  exists (
    select 1
    from public.stock_items si
    where si.id = coalesce(stock_movements.stock_item_id, stock_movements.item_id)
      and public.is_group_member(si.group_id)
  )
)
with check (
  exists (
    select 1
    from public.stock_items si
    where si.id = coalesce(stock_movements.stock_item_id, stock_movements.item_id)
      and public.is_group_member(si.group_id)
  )
);

commit;


-- ====================================================================
-- Migration: 20260423000003_rpc_finalize_shopping_list.sql
-- ====================================================================
-- Fase A (RPC transacional)
-- Data: 2026-04-23
-- Objetivo: finalizar lista de compras em uma transação lógica única
--          com atualização de estoque, criação de lotes e reaproveitamento
--          de pendências na próxima lista ativa.

begin;

create or replace function public.rpc_finalize_shopping_list(
  p_list_id uuid,
  p_purchase_date date default current_date
)
returns table (
  next_list_id uuid,
  bought_items_count integer,
  pending_items_count integer,
  finalized_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_group_id uuid;
  v_status text;
  v_total numeric := 0;
  v_bought_count integer := 0;
  v_pending_count integer := 0;
  v_next_list_id uuid;
  v_existing_active_list_id uuid;

  r record;
  v_qty numeric;
  v_unit text;
  v_lot_id uuid;
  v_product_id uuid;
  v_stock_item_id uuid;
  v_price_total numeric;
  v_price_unit numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select sl.group_id, sl.status
    into v_group_id, v_status
  from public.shopping_lists sl
  where sl.id = p_list_id
  for update;

  if v_group_id is null then
    raise exception 'Lista não encontrada';
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Sem permissão para finalizar lista deste grupo';
  end if;

  if coalesce(v_status, 'active') <> 'active' then
    raise exception 'Lista já não está ativa';
  end if;

  select
    count(*) filter (where i.comprado = true),
    count(*) filter (where i.comprado = false),
    coalesce(sum(coalesce(i.preco_total, i.preco, 0)), 0)
  into v_bought_count, v_pending_count, v_total
  from public.items i
  where i.list_id = p_list_id;

  for r in
    select
      i.id,
      i.nome,
      coalesce(nullif(i.categoria, ''), 'Outros') as categoria,
      i.product_id,
      i.quantidade_num,
      i.unidade,
      coalesce(i.quantidade_raw, i.quantidade, '1 un') as quantidade_raw,
      coalesce(i.preco_total, i.preco, 0) as preco_total,
      i.criado_por
    from public.items i
    where i.list_id = p_list_id
      and i.comprado = true
  loop
    v_product_id := r.product_id;

    v_qty := coalesce(r.quantidade_num, 0);
    if v_qty <= 0 then
      if regexp_match(trim(r.quantidade_raw), '^(\\d+(?:[\\.,]\\d+)?)') is not null then
        v_qty := replace((regexp_match(trim(r.quantidade_raw), '^(\\d+(?:[\\.,]\\d+)?)'))[1], ',', '.')::numeric;
      else
        v_qty := 1;
      end if;
    end if;

    v_unit := coalesce(nullif(r.unidade, ''), '');
    if v_unit = '' then
      if regexp_match(trim(r.quantidade_raw), '^\\d+(?:[\\.,]\\d+)?\\s+([[:alpha:]]+)$') is not null then
        v_unit := (regexp_match(trim(r.quantidade_raw), '^\\d+(?:[\\.,]\\d+)?\\s+([[:alpha:]]+)$'))[1];
      else
        v_unit := 'un';
      end if;
    end if;

    v_price_total := coalesce(r.preco_total, 0);
    v_price_unit := case when v_price_total > 0 and v_qty > 0 then v_price_total / v_qty else null end;

    if v_qty <= 0 then
      continue;
    end if;

    if v_product_id is null then
      select pc.id
        into v_product_id
      from public.product_catalog pc
      where pc.group_id = v_group_id
        and lower(pc.nome) = lower(r.nome)
        and pc.unidade_estoque = v_unit
      limit 1;
    end if;

    if v_product_id is null then
      insert into public.product_catalog (
        group_id,
        nome,
        categoria,
        consumo_tags,
        unidade_estoque,
        unidade_tipo,
        porcao_padrao,
        unidade_porcao,
        perecivel,
        ativo
      )
      values (
        v_group_id,
        r.nome,
        r.categoria,
        '{}',
        v_unit,
        'simple',
        1,
        'un',
        true,
        true
      )
      returning id into v_product_id;
    end if;

    select si.id
      into v_stock_item_id
    from public.stock_items si
    where si.group_id = v_group_id
      and si.product_id = v_product_id
    limit 1;

    if v_stock_item_id is null then
      insert into public.stock_items (
        group_id,
        product_id,
        nome,
        categoria,
        unidade,
        quantidade,
        quantidade_atual,
        quantidade_minima,
        tamanho_porcao,
        na_lista,
        auto_adicionar_lista,
        consumo_frequencia,
        consumo_valor,
        data_compra,
        data_validade
      )
      values (
        v_group_id,
        v_product_id,
        (select pc.nome from public.product_catalog pc where pc.id = v_product_id),
        (select pc.categoria from public.product_catalog pc where pc.id = v_product_id),
        v_unit,
        v_qty,
        v_qty,
        0,
        1,
        false,
        false,
        'weekly',
        0,
        p_purchase_date,
        null
      )
      returning id into v_stock_item_id;
    else
      update public.stock_items si
      set
        quantidade = coalesce(si.quantidade, 0) + v_qty,
        quantidade_atual = coalesce(si.quantidade_atual, coalesce(si.quantidade, 0)) + v_qty,
        data_compra = p_purchase_date
      where si.id = v_stock_item_id;
    end if;

    insert into public.stock_lots (
      stock_item_id,
      source_list_item_id,
      quantidade_inicial,
      quantidade_restante,
      unidade,
      custo_total,
      custo_unitario,
      fator_consumo,
      data_compra,
      data_validade,
      created_by
    )
    values (
      v_stock_item_id,
      r.id,
      v_qty,
      v_qty,
      v_unit,
      nullif(v_price_total, 0),
      v_price_unit,
      null,
      p_purchase_date,
      null,
      v_user_id
    )
    returning id into v_lot_id;

    insert into public.stock_movements (
      item_id,
      stock_item_id,
      lot_id,
      tipo,
      quantidade,
      unidade,
      custo_unitario_ref,
      observacao,
      origem,
      source_list_id,
      source_list_item_id,
      criado_por
    )
    values (
      v_stock_item_id,
      v_stock_item_id,
      v_lot_id,
      'entrada',
      v_qty,
      v_unit,
      v_price_unit,
      'Entrada por finalização de compra',
      'list_finalize',
      p_list_id,
      r.id,
      v_user_id
    );
  end loop;

  update public.shopping_lists
  set
    ativa = false,
    status = 'closed',
    finalizada_em = now(),
    finalized_at = now(),
    closed_purchase_date = p_purchase_date,
    fechado_por = v_user_id,
    total = nullif(v_total, 0)
  where id = p_list_id;

  select sl.id
    into v_existing_active_list_id
  from public.shopping_lists sl
  where sl.group_id = v_group_id
    and sl.status = 'active'
    and sl.ativa = true
  limit 1;

  if v_existing_active_list_id is null then
    insert into public.shopping_lists (group_id, ativa, status)
    values (v_group_id, true, 'active')
    returning id into v_next_list_id;
  else
    v_next_list_id := v_existing_active_list_id;
  end if;

  insert into public.items (
    list_id,
    product_id,
    nome,
    quantidade,
    quantidade_raw,
    quantidade_num,
    unidade,
    categoria,
    comprado,
    preco,
    preco_total,
    preco_unitario,
    criado_por
  )
  select
    v_next_list_id,
    i.product_id,
    i.nome,
    i.quantidade,
    coalesce(i.quantidade_raw, i.quantidade),
    i.quantidade_num,
    i.unidade,
    i.categoria,
    false,
    i.preco,
    coalesce(i.preco_total, i.preco),
    i.preco_unitario,
    i.criado_por
  from public.items i
  where i.list_id = p_list_id
    and i.comprado = false;

  next_list_id := v_next_list_id;
  bought_items_count := v_bought_count;
  pending_items_count := v_pending_count;
  finalized_total := v_total;

  return next;
end;
$$;

revoke all on function public.rpc_finalize_shopping_list(uuid, date) from public;
grant execute on function public.rpc_finalize_shopping_list(uuid, date) to authenticated;

commit;


-- ====================================================================
-- Migration: 20260423000004_fix_finalize_active_list_conflict.sql
-- ====================================================================
-- Fase A (hotfix) - Evita conflito de unique index ao finalizar compra
-- Data: 2026-04-23

begin;

create or replace function public.rpc_finalize_shopping_list(
  p_list_id uuid,
  p_purchase_date date default current_date
)
returns table (
  next_list_id uuid,
  bought_items_count integer,
  pending_items_count integer,
  finalized_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_group_id uuid;
  v_status text;
  v_total numeric := 0;
  v_bought_count integer := 0;
  v_pending_count integer := 0;
  v_next_list_id uuid;
  v_existing_active_list_id uuid;

  r record;
  v_qty numeric;
  v_unit text;
  v_lot_id uuid;
  v_product_id uuid;
  v_stock_item_id uuid;
  v_price_total numeric;
  v_price_unit numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select sl.group_id, sl.status
    into v_group_id, v_status
  from public.shopping_lists sl
  where sl.id = p_list_id
  for update;

  if v_group_id is null then
    raise exception 'Lista não encontrada';
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Sem permissão para finalizar lista deste grupo';
  end if;

  if coalesce(v_status, 'active') <> 'active' then
    raise exception 'Lista já não está ativa';
  end if;

  select
    count(*) filter (where i.comprado = true),
    count(*) filter (where i.comprado = false),
    coalesce(sum(coalesce(i.preco_total, i.preco, 0)), 0)
  into v_bought_count, v_pending_count, v_total
  from public.items i
  where i.list_id = p_list_id;

  for r in
    select
      i.id,
      i.nome,
      coalesce(nullif(i.categoria, ''), 'Outros') as categoria,
      i.product_id,
      i.quantidade_num,
      i.unidade,
      coalesce(i.quantidade_raw, i.quantidade, '1 un') as quantidade_raw,
      coalesce(i.preco_total, i.preco, 0) as preco_total,
      i.criado_por
    from public.items i
    where i.list_id = p_list_id
      and i.comprado = true
  loop
    v_product_id := r.product_id;

    v_qty := coalesce(r.quantidade_num, 0);
    if v_qty <= 0 then
      if regexp_match(trim(r.quantidade_raw), '^(\\d+(?:[\\.,]\\d+)?)') is not null then
        v_qty := replace((regexp_match(trim(r.quantidade_raw), '^(\\d+(?:[\\.,]\\d+)?)'))[1], ',', '.')::numeric;
      else
        v_qty := 1;
      end if;
    end if;

    v_unit := coalesce(nullif(r.unidade, ''), '');
    if v_unit = '' then
      if regexp_match(trim(r.quantidade_raw), '^\\d+(?:[\\.,]\\d+)?\\s+([[:alpha:]]+)$') is not null then
        v_unit := (regexp_match(trim(r.quantidade_raw), '^\\d+(?:[\\.,]\\d+)?\\s+([[:alpha:]]+)$'))[1];
      else
        v_unit := 'un';
      end if;
    end if;

    v_price_total := coalesce(r.preco_total, 0);
    v_price_unit := case when v_price_total > 0 and v_qty > 0 then v_price_total / v_qty else null end;

    if v_qty <= 0 then
      continue;
    end if;

    if v_product_id is null then
      select pc.id
        into v_product_id
      from public.product_catalog pc
      where pc.group_id = v_group_id
        and lower(pc.nome) = lower(r.nome)
        and pc.unidade_estoque = v_unit
      limit 1;
    end if;

    if v_product_id is null then
      insert into public.product_catalog (
        group_id,
        nome,
        categoria,
        consumo_tags,
        unidade_estoque,
        unidade_tipo,
        porcao_padrao,
        unidade_porcao,
        perecivel,
        ativo
      )
      values (
        v_group_id,
        r.nome,
        r.categoria,
        '{}',
        v_unit,
        'simple',
        1,
        'un',
        true,
        true
      )
      returning id into v_product_id;
    end if;

    select si.id
      into v_stock_item_id
    from public.stock_items si
    where si.group_id = v_group_id
      and si.product_id = v_product_id
    limit 1;

    if v_stock_item_id is null then
      insert into public.stock_items (
        group_id,
        product_id,
        nome,
        categoria,
        unidade,
        quantidade,
        quantidade_atual,
        quantidade_minima,
        tamanho_porcao,
        na_lista,
        auto_adicionar_lista,
        consumo_frequencia,
        consumo_valor,
        data_compra,
        data_validade
      )
      values (
        v_group_id,
        v_product_id,
        (select pc.nome from public.product_catalog pc where pc.id = v_product_id),
        (select pc.categoria from public.product_catalog pc where pc.id = v_product_id),
        v_unit,
        v_qty,
        v_qty,
        0,
        1,
        false,
        false,
        'weekly',
        0,
        p_purchase_date,
        null
      )
      returning id into v_stock_item_id;
    else
      update public.stock_items si
      set
        quantidade = coalesce(si.quantidade, 0) + v_qty,
        quantidade_atual = coalesce(si.quantidade_atual, coalesce(si.quantidade, 0)) + v_qty,
        data_compra = p_purchase_date
      where si.id = v_stock_item_id;
    end if;

    insert into public.stock_lots (
      stock_item_id,
      source_list_item_id,
      quantidade_inicial,
      quantidade_restante,
      unidade,
      custo_total,
      custo_unitario,
      fator_consumo,
      data_compra,
      data_validade,
      created_by
    )
    values (
      v_stock_item_id,
      r.id,
      v_qty,
      v_qty,
      v_unit,
      nullif(v_price_total, 0),
      v_price_unit,
      null,
      p_purchase_date,
      null,
      v_user_id
    )
    returning id into v_lot_id;

    insert into public.stock_movements (
      item_id,
      stock_item_id,
      lot_id,
      tipo,
      quantidade,
      unidade,
      custo_unitario_ref,
      observacao,
      origem,
      source_list_id,
      source_list_item_id,
      criado_por
    )
    values (
      v_stock_item_id,
      v_stock_item_id,
      v_lot_id,
      'entrada',
      v_qty,
      v_unit,
      v_price_unit,
      'Entrada por finalização de compra',
      'list_finalize',
      p_list_id,
      r.id,
      v_user_id
    );
  end loop;

  update public.shopping_lists
  set
    ativa = false,
    status = 'closed',
    finalizada_em = now(),
    finalized_at = now(),
    closed_purchase_date = p_purchase_date,
    fechado_por = v_user_id,
    total = nullif(v_total, 0)
  where id = p_list_id;

  -- Reaproveita qualquer lista ativa do grupo, mesmo que status esteja legado/inconsistente.
  select sl.id
    into v_existing_active_list_id
  from public.shopping_lists sl
  where sl.group_id = v_group_id
    and sl.ativa = true
    and sl.id <> p_list_id
  order by sl.criada_em desc nulls last, sl.id desc
  limit 1;

  if v_existing_active_list_id is null then
    begin
      insert into public.shopping_lists (group_id, ativa, status)
      values (v_group_id, true, 'active')
      returning id into v_next_list_id;
    exception
      when unique_violation then
        select sl.id
          into v_next_list_id
        from public.shopping_lists sl
        where sl.group_id = v_group_id
          and sl.ativa = true
        order by sl.criada_em desc nulls last, sl.id desc
        limit 1;

        if v_next_list_id is null then
          raise;
        end if;
    end;
  else
    v_next_list_id := v_existing_active_list_id;
  end if;

  insert into public.items (
    list_id,
    product_id,
    nome,
    quantidade,
    quantidade_raw,
    quantidade_num,
    unidade,
    categoria,
    comprado,
    preco,
    preco_total,
    preco_unitario,
    criado_por
  )
  select
    v_next_list_id,
    i.product_id,
    i.nome,
    i.quantidade,
    coalesce(i.quantidade_raw, i.quantidade),
    i.quantidade_num,
    i.unidade,
    i.categoria,
    false,
    i.preco,
    coalesce(i.preco_total, i.preco),
    i.preco_unitario,
    i.criado_por
  from public.items i
  where i.list_id = p_list_id
    and i.comprado = false;

  next_list_id := v_next_list_id;
  bought_items_count := v_bought_count;
  pending_items_count := v_pending_count;
  finalized_total := v_total;

  return next;
end;
$$;

revoke all on function public.rpc_finalize_shopping_list(uuid, date) from public;
grant execute on function public.rpc_finalize_shopping_list(uuid, date) to authenticated;

commit;


-- ====================================================================
-- Migration: 20260423000012_baseline_rate_limits.sql
-- ====================================================================
-- Baseline retroativo: tabela rate_limits
-- Data: 2026-05-02
-- Objetivo: versionar a criação da tabela rate_limits que existe no banco
--           sem migration. Usada para limitar tentativas por usuário/ação
--           (ex: login, criação de grupo).

begin;

-- Tabela
create table if not exists public.rate_limits (
  id bigserial primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);

-- Índice composto para consultas "qtd por usuário/ação numa janela"
create index if not exists idx_rate_limits_user_action_created_at
  on public.rate_limits (user_id, action, created_at desc);

-- RLS habilitado, permitindo apenas INSERT pelo próprio usuário.
-- A tabela é consultada por edge functions/RPCs com privilégio elevado;
-- por isso não há políticas de SELECT/UPDATE/DELETE para clientes.
alter table public.rate_limits enable row level security;

drop policy if exists rate_limits_insert_self on public.rate_limits;
create policy rate_limits_insert_self
  on public.rate_limits
  for insert
  to authenticated
  with check (auth.uid() = user_id);

commit;


-- ====================================================================
-- Migration: 20260423000013_baseline_group_rpcs.sql
-- ====================================================================
-- Baseline retroativo: RPCs de grupo
-- Data: 2026-05-02
-- Objetivo: versionar create_group e join_group_by_code que existem no banco
--           mas nunca foram versionadas neste repositório.

begin;

-- =====================================================
-- create_group(p_nome text)
-- Cria um grupo e adiciona o caller como membro fundador.
-- =====================================================
create or replace function public.create_group(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_group_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Nome do grupo é obrigatório';
  end if;

  insert into public.groups (nome)
  values (btrim(p_nome))
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id);

  return v_group_id;
end;
$$;

revoke all on function public.create_group(text) from public;
grant execute on function public.create_group(text) to authenticated;

-- =====================================================
-- join_group_by_code(p_codigo text)
-- Adiciona o caller a um grupo via código de convite.
-- Retorna { group_id, nome }.
-- =====================================================
create or replace function public.join_group_by_code(p_codigo text)
returns table (group_id uuid, nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_group_id uuid;
  v_nome text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_codigo is null or btrim(p_codigo) = '' then
    raise exception 'Código de convite é obrigatório';
  end if;

  select g.id, g.nome
    into v_group_id, v_nome
  from public.groups g
  where g.codigo_convite = btrim(p_codigo)
  limit 1;

  if v_group_id is null then
    raise exception 'Grupo não encontrado para este código';
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id)
  on conflict (group_id, user_id) do nothing;

  group_id := v_group_id;
  nome := v_nome;
  return next;
end;
$$;

revoke all on function public.join_group_by_code(text) from public;
grant execute on function public.join_group_by_code(text) to authenticated;

commit;


-- ====================================================================
-- Migration: 20260423000014_baseline_stock_sync_triggers.sql
-- ====================================================================
-- Baseline retroativo: triggers de sincronização stock_lots → stock_items
-- Data: 2026-05-02
-- Objetivo: versionar as funções/triggers que mantêm
--   stock_items.quantidade   = SUM(stock_lots.quantidade_restante)
--   stock_items.data_validade = MIN(stock_lots.data_validade)
-- Existem no banco mas não estão versionadas (drift histórico).

begin;

-- =====================================================
-- 1) Função: sync_stock_item_quantity
-- Recalcula stock_items.quantidade somando os lotes restantes.
-- =====================================================
create or replace function public.sync_stock_item_quantity()
returns trigger
language plpgsql
as $$
declare
  v_stock_item_id uuid;
begin
  v_stock_item_id := coalesce(new.stock_item_id, old.stock_item_id);
  if v_stock_item_id is null then
    return coalesce(new, old);
  end if;

  update public.stock_items si
  set quantidade = coalesce((
    select sum(coalesce(sl.quantidade_restante, 0))
    from public.stock_lots sl
    where sl.stock_item_id = v_stock_item_id
  ), 0)
  where si.id = v_stock_item_id;

  return coalesce(new, old);
end;
$$;

-- =====================================================
-- 2) Função: sync_stock_item_validade
-- Atualiza stock_items.data_validade com o MIN dos lotes ativos
-- (apenas lotes com quantidade_restante > 0 contam).
-- =====================================================
create or replace function public.sync_stock_item_validade()
returns trigger
language plpgsql
as $$
declare
  v_stock_item_id uuid;
begin
  v_stock_item_id := coalesce(new.stock_item_id, old.stock_item_id);
  if v_stock_item_id is null then
    return coalesce(new, old);
  end if;

  update public.stock_items si
  set data_validade = (
    select min(sl.data_validade)
    from public.stock_lots sl
    where sl.stock_item_id = v_stock_item_id
      and coalesce(sl.quantidade_restante, 0) > 0
      and sl.data_validade is not null
  )
  where si.id = v_stock_item_id;

  return coalesce(new, old);
end;
$$;

-- =====================================================
-- 3) Função: set_atualizado_em_stock_items
-- Mantém stock_items.atualizado_em ao mudar a linha.
-- (Convive com trg_stock_items_updated_at que cuida de updated_at.)
-- =====================================================
create or replace function public.set_atualizado_em_stock_items()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- =====================================================
-- 4) Triggers em stock_lots
-- =====================================================
drop trigger if exists trg_sync_stock_item_quantity on public.stock_lots;
create trigger trg_sync_stock_item_quantity
after insert or update or delete on public.stock_lots
for each row
execute function public.sync_stock_item_quantity();

drop trigger if exists trg_sync_stock_item_validade on public.stock_lots;
create trigger trg_sync_stock_item_validade
after insert or update or delete on public.stock_lots
for each row
execute function public.sync_stock_item_validade();

-- =====================================================
-- 5) Trigger em stock_items
-- =====================================================
drop trigger if exists trg_set_atualizado_em_stock_items on public.stock_items;
create trigger trg_set_atualizado_em_stock_items
before update on public.stock_items
for each row
execute function public.set_atualizado_em_stock_items();

commit;


-- ====================================================================
-- Migration: 20260423000015_baseline_consume_stock_fifo.sql
-- ====================================================================
-- Baseline retroativo: consume_stock_fifo
-- Data: 2026-05-02
-- Objetivo: versionar a função de consumo FIFO que existe no banco
--           sem migration. Consome dos lotes mais antigos / mais próximos
--           de vencer primeiro. Retorna a quantidade efetivamente consumida.

begin;

create or replace function public.consume_stock_fifo(
  p_stock_item_id uuid,
  p_quantidade numeric,
  p_tipo text default 'saida',
  p_observacao text default null,
  p_origem text default 'quick_consume',
  p_criado_por uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_group_id uuid;
  v_unidade text;
  v_remaining numeric;
  v_consumed_total numeric := 0;
  v_take numeric;
  r record;
begin
  v_user_id := coalesce(p_criado_por, auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  select si.group_id, si.unidade
    into v_group_id, v_unidade
  from public.stock_items si
  where si.id = p_stock_item_id;

  if v_group_id is null then
    raise exception 'Item de estoque não encontrado: %', p_stock_item_id;
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Sem permissão para consumir este item';
  end if;

  v_remaining := p_quantidade;

  -- Itera lotes em ordem FIFO:
  --   1) lotes com data_validade mais próxima primeiro (NULLs por último)
  --   2) desempate por data_compra mais antiga
  --   3) desempate final por created_at
  for r in
    select sl.id, sl.quantidade_restante, sl.custo_unitario
    from public.stock_lots sl
    where sl.stock_item_id = p_stock_item_id
      and coalesce(sl.quantidade_restante, 0) > 0
    order by
      sl.data_validade asc nulls last,
      sl.data_compra asc nulls last,
      sl.created_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(r.quantidade_restante, v_remaining);

    update public.stock_lots
    set quantidade_restante = quantidade_restante - v_take
    where id = r.id;

    insert into public.stock_movements (
      item_id, stock_item_id, lot_id, tipo, quantidade, unidade,
      custo_unitario_ref, observacao, origem, criado_por
    )
    values (
      p_stock_item_id, p_stock_item_id, r.id, p_tipo, v_take, v_unidade,
      r.custo_unitario, p_observacao, p_origem, v_user_id
    );

    v_remaining := v_remaining - v_take;
    v_consumed_total := v_consumed_total + v_take;
  end loop;

  -- Os triggers trg_sync_stock_item_* recalculam quantidade e data_validade.
  return v_consumed_total;
end;
$$;

revoke all on function public.consume_stock_fifo(uuid, numeric, text, text, text, uuid) from public;
grant execute on function public.consume_stock_fifo(uuid, numeric, text, text, text, uuid) to authenticated;

commit;


-- ====================================================================
-- Migration: 20260423000016_baseline_pack_columns.sql
-- ====================================================================
-- Baseline retroativo: stock_items.pack_size / pack_label
-- Data: 2026-05-02
-- Objetivo: versionar as colunas que existem no banco mas não foram criadas
--           por nenhuma migration. Permitem registrar a embalagem padrão
--           (ex: pack_size = 5, pack_label = 'kg').

begin;

alter table public.stock_items
  add column if not exists pack_size numeric,
  add column if not exists pack_label text;

commit;


-- ====================================================================
-- Migration: 20260424000001_phase_a_v2_rls_policy_cleanup.sql
-- ====================================================================
-- Fase A (RLS hardening) - Limpeza de políticas legadas e padronização V2
-- Data: 2026-04-24

begin;

alter table public.shopping_lists enable row level security;
alter table public.items enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.product_catalog enable row level security;
alter table public.stock_lots enable row level security;

-- Remove políticas legadas para evitar ambiguidades e manter uma fonte de verdade.
drop policy if exists "Acesso via lista de compras" on public.items;
drop policy if exists "atualizar item" on public.items;
drop policy if exists "criar item" on public.items;
drop policy if exists "deletar item" on public.items;
drop policy if exists "ver itens" on public.items;

drop policy if exists "Acesso por membro do grupo" on public.shopping_lists;
drop policy if exists "atualizar lista" on public.shopping_lists;
drop policy if exists "criar lista" on public.shopping_lists;
drop policy if exists "ver listas" on public.shopping_lists;

drop policy if exists "Acesso por membro do grupo" on public.product_catalog;

drop policy if exists "Acesso por membro do grupo" on public.stock_items;
drop policy if exists "stock_items_delete_by_group_member" on public.stock_items;
drop policy if exists "stock_items_insert_by_group_member" on public.stock_items;
drop policy if exists "stock_items_select_by_group_member" on public.stock_items;
drop policy if exists "stock_items_update_by_group_member" on public.stock_items;

drop policy if exists "Acesso via item de estoque" on public.stock_lots;

drop policy if exists "Acesso via movimentacao" on public.stock_movements;
drop policy if exists "stock_movements_insert_by_group_member" on public.stock_movements;
drop policy if exists "stock_movements_select_by_group_member" on public.stock_movements;

-- Recria as políticas canônicas V2 com escopo authenticated.
drop policy if exists shopping_lists_select_v2 on public.shopping_lists;
create policy shopping_lists_select_v2
on public.shopping_lists
for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists shopping_lists_insert_v2 on public.shopping_lists;
create policy shopping_lists_insert_v2
on public.shopping_lists
for insert
to authenticated
with check (public.is_group_member(group_id));

drop policy if exists shopping_lists_update_v2 on public.shopping_lists;
create policy shopping_lists_update_v2
on public.shopping_lists
for update
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

drop policy if exists shopping_lists_delete_v2 on public.shopping_lists;
create policy shopping_lists_delete_v2
on public.shopping_lists
for delete
to authenticated
using (public.is_group_member(group_id));

drop policy if exists items_all_v2 on public.items;
create policy items_all_v2
on public.items
for all
to authenticated
using (
  exists (
    select 1
    from public.shopping_lists sl
    where sl.id = items.list_id
      and public.is_group_member(sl.group_id)
  )
)
with check (
  exists (
    select 1
    from public.shopping_lists sl
    where sl.id = items.list_id
      and public.is_group_member(sl.group_id)
  )
);

drop policy if exists product_catalog_select on public.product_catalog;
create policy product_catalog_select
on public.product_catalog
for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists product_catalog_insert on public.product_catalog;
create policy product_catalog_insert
on public.product_catalog
for insert
to authenticated
with check (public.is_group_member(group_id));

drop policy if exists product_catalog_update on public.product_catalog;
create policy product_catalog_update
on public.product_catalog
for update
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

drop policy if exists product_catalog_delete on public.product_catalog;
create policy product_catalog_delete
on public.product_catalog
for delete
to authenticated
using (public.is_group_member(group_id));

drop policy if exists stock_items_all_v2 on public.stock_items;
create policy stock_items_all_v2
on public.stock_items
for all
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

drop policy if exists stock_lots_all on public.stock_lots;
create policy stock_lots_all
on public.stock_lots
for all
to authenticated
using (
  exists (
    select 1
    from public.stock_items si
    where si.id = stock_lots.stock_item_id
      and public.is_group_member(si.group_id)
  )
)
with check (
  exists (
    select 1
    from public.stock_items si
    where si.id = stock_lots.stock_item_id
      and public.is_group_member(si.group_id)
  )
);

drop policy if exists stock_movements_all_v2 on public.stock_movements;
create policy stock_movements_all_v2
on public.stock_movements
for all
to authenticated
using (
  exists (
    select 1
    from public.stock_items si
    where si.id = coalesce(stock_movements.stock_item_id, stock_movements.item_id)
      and public.is_group_member(si.group_id)
  )
)
with check (
  exists (
    select 1
    from public.stock_items si
    where si.id = coalesce(stock_movements.stock_item_id, stock_movements.item_id)
      and public.is_group_member(si.group_id)
  )
);

commit;


-- ====================================================================
-- Migration: 20260425003437_fix_finalize_shopping_rpc.sql
-- ====================================================================
-- Fase A (hotfix) - Evita conflito de unique index ao finalizar compra
-- Data: 2026-04-23

begin;

create or replace function public.rpc_finalize_shopping_list(
  p_list_id uuid,
  p_purchase_date date default current_date
)
returns table (
  next_list_id uuid,
  bought_items_count integer,
  pending_items_count integer,
  finalized_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_group_id uuid;
  v_status text;
  v_total numeric := 0;
  v_bought_count integer := 0;
  v_pending_count integer := 0;
  v_next_list_id uuid;
  v_existing_active_list_id uuid;

  r record;
  v_qty numeric;
  v_unit text;
  v_lot_id uuid;
  v_product_id uuid;
  v_stock_item_id uuid;
  v_price_total numeric;
  v_price_unit numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select sl.group_id, sl.status
    into v_group_id, v_status
  from public.shopping_lists sl
  where sl.id = p_list_id
  for update;

  if v_group_id is null then
    raise exception 'Lista não encontrada';
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Sem permissão para finalizar lista deste grupo';
  end if;

  if coalesce(v_status, 'active') <> 'active' then
    raise exception 'Lista já não está ativa';
  end if;

  select
    count(*) filter (where i.comprado = true),
    count(*) filter (where i.comprado = false),
    coalesce(sum(coalesce(i.preco_total, i.preco, 0)), 0)
  into v_bought_count, v_pending_count, v_total
  from public.items i
  where i.list_id = p_list_id;

  for r in
    select
      i.id,
      i.nome,
      coalesce(nullif(i.categoria, ''), 'Outros') as categoria,
      i.product_id,
      i.quantidade_num,
      i.unidade,
      coalesce(i.quantidade_raw, i.quantidade, '1 un') as quantidade_raw,
      coalesce(i.preco_total, i.preco, 0) as preco_total,
      i.criado_por
    from public.items i
    where i.list_id = p_list_id
      and i.comprado = true
  loop
    v_product_id := r.product_id;

    v_qty := coalesce(r.quantidade_num, 0);
    if v_qty <= 0 then
      if regexp_match(trim(r.quantidade_raw), '^(\d+(?:[\.,]\d+)?)') is not null then
        v_qty := replace((regexp_match(trim(r.quantidade_raw), '^(\d+(?:[\.,]\d+)?)'))[1], ',', '.')::numeric;
      else
        v_qty := 1;
      end if;
    end if;

    v_unit := coalesce(nullif(r.unidade, ''), '');
    if v_unit = '' then
      if regexp_match(trim(r.quantidade_raw), '^\d+(?:[\.,]\d+)?\s+([[:alpha:]]+)$') is not null then
        v_unit := (regexp_match(trim(r.quantidade_raw), '^\d+(?:[\.,]\d+)?\s+([[:alpha:]]+)$'))[1];
      else
        v_unit := 'un';
      end if;
    end if;

    v_price_total := coalesce(r.preco_total, 0);
    v_price_unit := case when v_price_total > 0 and v_qty > 0 then v_price_total / v_qty else null end;

    if v_qty <= 0 then
      continue;
    end if;

    if v_product_id is null then
      select pc.id
        into v_product_id
      from public.product_catalog pc
      where pc.group_id = v_group_id
        and lower(pc.nome) = lower(r.nome)
        and pc.unidade_estoque = v_unit
      limit 1;
    end if;

    if v_product_id is null then
      insert into public.product_catalog (
        group_id,
        nome,
        categoria,
        consumo_tags,
        unidade_estoque,
        unidade_tipo,
        porcao_padrao,
        unidade_porcao,
        perecivel,
        ativo
      )
      values (
        v_group_id,
        r.nome,
        r.categoria,
        '{}',
        v_unit,
        'simple',
        1,
        'un',
        true,
        true
      )
      returning id into v_product_id;
    end if;

    select si.id
      into v_stock_item_id
    from public.stock_items si
    where si.group_id = v_group_id
      and si.product_id = v_product_id
    limit 1;

    if v_stock_item_id is null then
      insert into public.stock_items (
        group_id,
        product_id,
        nome,
        categoria,
        unidade,
        quantidade,
        quantidade_atual,
        quantidade_minima,
        tamanho_porcao,
        na_lista,
        auto_adicionar_lista,
        consumo_frequencia,
        consumo_valor,
        data_compra,
        data_validade
      )
      values (
        v_group_id,
        v_product_id,
        (select pc.nome from public.product_catalog pc where pc.id = v_product_id),
        (select pc.categoria from public.product_catalog pc where pc.id = v_product_id),
        v_unit,
        v_qty,
        v_qty,
        0,
        1,
        false,
        false,
        'weekly',
        0,
        p_purchase_date,
        null
      )
      returning id into v_stock_item_id;
    else
      update public.stock_items si
      set
        quantidade = coalesce(si.quantidade, 0) + v_qty,
        quantidade_atual = coalesce(si.quantidade_atual, coalesce(si.quantidade, 0)) + v_qty,
        data_compra = p_purchase_date
      where si.id = v_stock_item_id;
    end if;

    insert into public.stock_lots (
      stock_item_id,
      source_list_item_id,
      quantidade_inicial,
      quantidade_restante,
      unidade,
      custo_total,
      custo_unitario,
      fator_consumo,
      data_compra,
      data_validade,
      created_by
    )
    values (
      v_stock_item_id,
      r.id,
      v_qty,
      v_qty,
      v_unit,
      nullif(v_price_total, 0),
      v_price_unit,
      null,
      p_purchase_date,
      null,
      v_user_id
    )
    returning id into v_lot_id;

    insert into public.stock_movements (
      item_id,
      stock_item_id,
      lot_id,
      tipo,
      quantidade,
      unidade,
      custo_unitario_ref,
      observacao,
      origem,
      source_list_id,
      source_list_item_id,
      criado_por
    )
    values (
      v_stock_item_id,
      v_stock_item_id,
      v_lot_id,
      'entrada',
      v_qty,
      v_unit,
      v_price_unit,
      'Entrada por finalização de compra',
      'list_finalize',
      p_list_id,
      r.id,
      v_user_id
    );
  end loop;

  update public.shopping_lists
  set
    ativa = false,
    status = 'closed',
    finalizada_em = now(),
    finalized_at = now(),
    closed_purchase_date = p_purchase_date,
    fechado_por = v_user_id,
    total = nullif(v_total, 0)
  where id = p_list_id;

  -- Reaproveita qualquer lista ativa do grupo, mesmo que status esteja legado/inconsistente.
  select sl.id
    into v_existing_active_list_id
  from public.shopping_lists sl
  where sl.group_id = v_group_id
    and sl.ativa = true
    and sl.id <> p_list_id
  order by sl.criada_em desc nulls last, sl.id desc
  limit 1;

  if v_existing_active_list_id is null then
    begin
      insert into public.shopping_lists (group_id, ativa, status)
      values (v_group_id, true, 'active')
      returning id into v_next_list_id;
    exception
      when unique_violation then
        select sl.id
          into v_next_list_id
        from public.shopping_lists sl
        where sl.group_id = v_group_id
          and sl.ativa = true
        order by sl.criada_em desc nulls last, sl.id desc
        limit 1;

        if v_next_list_id is null then
          raise;
        end if;
    end;
  else
    v_next_list_id := v_existing_active_list_id;
  end if;

  insert into public.items (
    list_id,
    product_id,
    nome,
    quantidade,
    quantidade_raw,
    quantidade_num,
    unidade,
    categoria,
    comprado,
    preco,
    preco_total,
    preco_unitario,
    criado_por
  )
  select
    v_next_list_id,
    i.product_id,
    i.nome,
    i.quantidade,
    coalesce(i.quantidade_raw, i.quantidade),
    i.quantidade_num,
    i.unidade,
    i.categoria,
    false,
    i.preco,
    coalesce(i.preco_total, i.preco),
    i.preco_unitario,
    i.criado_por
  from public.items i
  where i.list_id = p_list_id
    and i.comprado = false;

  delete from public.items
  where list_id = p_list_id
    and comprado = false;

  next_list_id := v_next_list_id;
  bought_items_count := v_bought_count;
  pending_items_count := v_pending_count;
  finalized_total := v_total;

  return next;
end;
$$;

revoke all on function public.rpc_finalize_shopping_list(uuid, date) from public;
grant execute on function public.rpc_finalize_shopping_list(uuid, date) to authenticated;

commit;


-- ====================================================================
-- Migration: 20260501000000_bulk_expiration_feature.sql
-- ====================================================================
BEGIN;

-- 1. Schema Updates: Support for persistent "Does not apply" state and catalog learning
-- Note: perecivel and data_validade_alerta are part of the spec; using IF NOT EXISTS
-- so the migration is idempotent regardless of prior schema state.
ALTER TABLE public.product_catalog 
  ADD COLUMN IF NOT EXISTS perecivel BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS validade_padrao_dias INT NULL;

ALTER TABLE public.stock_items 
  ADD COLUMN IF NOT EXISTS data_validade_alerta DATE NULL,
  ADD COLUMN IF NOT EXISTS validade_nao_aplica BOOLEAN DEFAULT false;

-- Support setting expiration data directly on shopping list items
ALTER TABLE public.items 
  ADD COLUMN IF NOT EXISTS data_validade DATE NULL,
  ADD COLUMN IF NOT EXISTS nao_aplica_validade BOOLEAN DEFAULT false;

-- 2. Update the 'rpc_finalize_shopping_list' function to process expiration data
CREATE OR REPLACE FUNCTION public.rpc_finalize_shopping_list(
  p_list_id uuid,
  p_purchase_date date DEFAULT current_date
)
RETURNS TABLE(next_list_id uuid, bought_items_count integer, pending_items_count integer, finalized_total numeric) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_group_id uuid;
  v_status text;
  v_total numeric := 0;
  v_bought_count integer := 0;
  v_pending_count integer := 0;
  v_next_list_id uuid;
  v_existing_active_list_id uuid;

  r record;
  v_qty numeric;
  v_unit text;
  v_lot_id uuid;
  v_product_id uuid;
  v_stock_item_id uuid;
  v_price_total numeric;
  v_price_unit numeric;
  v_perecivel boolean;
BEGIN
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select sl.group_id, sl.status
    into v_group_id, v_status
  from public.shopping_lists sl
  where sl.id = p_list_id
  for update;

  if v_group_id is null then
    raise exception 'Lista não encontrada';
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Sem permissão para finalizar lista deste grupo';
  end if;

  if coalesce(v_status, 'active') <> 'active' then
    raise exception 'Lista já não está ativa';
  end if;

  select
    count(*) filter (where i.comprado = true),
    count(*) filter (where i.comprado = false),
    coalesce(sum(coalesce(i.preco_total, i.preco, 0)), 0)
  into v_bought_count, v_pending_count, v_total
  from public.items i
  where i.list_id = p_list_id;

  for r in
    select
      i.id,
      i.nome,
      coalesce(nullif(i.categoria, ''), 'Outros') as categoria,
      i.product_id,
      i.quantidade_num,
      i.unidade,
      coalesce(i.quantidade_raw, i.quantidade, '1 un') as quantidade_raw,
      coalesce(i.preco_total, i.preco, 0) as preco_total,
      i.criado_por,
      i.data_validade,
      i.nao_aplica_validade
    from public.items i
    where i.list_id = p_list_id
      and i.comprado = true
  loop
    v_product_id := r.product_id;

    v_qty := coalesce(r.quantidade_num, 0);
    if v_qty <= 0 then
      if regexp_match(trim(r.quantidade_raw), '^(\d+(?:[\.,]\d+)?)') is not null then
        v_qty := replace((regexp_match(trim(r.quantidade_raw), '^(\d+(?:[\.,]\d+)?)'))[1], ',', '.')::numeric;
      else
        v_qty := 1;
      end if;
    end if;

    v_unit := coalesce(nullif(r.unidade, ''), '');
    if v_unit = '' then
      if regexp_match(trim(r.quantidade_raw), '^\d+(?:[\.,]\d+)?\s+([[:alpha:]]+)$') is not null then
        v_unit := (regexp_match(trim(r.quantidade_raw), '^\d+(?:[\.,]\d+)?\s+([[:alpha:]]+)$'))[1];
      else
        v_unit := 'un';
      end if;
    end if;

    v_price_total := coalesce(r.preco_total, 0);
    v_price_unit := case when v_price_total > 0 and v_qty > 0 then v_price_total / v_qty else null end;

    if v_qty <= 0 then
      continue;
    end if;

    if v_product_id is null then
      select pc.id, pc.perecivel
        into v_product_id, v_perecivel
      from public.product_catalog pc
      where pc.group_id = v_group_id
        and lower(pc.nome) = lower(r.nome)
        and pc.unidade_estoque = v_unit
      limit 1;
    else
      select pc.perecivel into v_perecivel from public.product_catalog pc where pc.id = v_product_id;
    end if;

    if v_product_id is null then
      insert into public.product_catalog (
        group_id,
        nome,
        categoria,
        consumo_tags,
        unidade_estoque,
        unidade_tipo,
        porcao_padrao,
        unidade_porcao,
        perecivel,
        ativo
      )
      values (
        v_group_id,
        r.nome,
        r.categoria,
        '{}',
        v_unit,
        'simple',
        1,
        'un',
        true,
        true
      )
      returning id, perecivel into v_product_id, v_perecivel;
    end if;

    select si.id
      into v_stock_item_id
    from public.stock_items si
    where si.group_id = v_group_id
      and si.product_id = v_product_id
    limit 1;

    if v_stock_item_id is null then
      insert into public.stock_items (
        group_id,
        product_id,
        nome,
        categoria,
        unidade,
        quantidade,
        quantidade_atual,
        quantidade_minima,
        tamanho_porcao,
        na_lista,
        auto_adicionar_lista,
        consumo_frequencia,
        consumo_valor,
        data_compra,
        data_validade,
        data_validade_alerta,
        validade_nao_aplica
      )
      values (
        v_group_id,
        v_product_id,
        (select pc.nome from public.product_catalog pc where pc.id = v_product_id),
        (select pc.categoria from public.product_catalog pc where pc.id = v_product_id),
        v_unit,
        v_qty,
        v_qty,
        0,
        1,
        false,
        false,
        'weekly',
        0,
        p_purchase_date,
        r.data_validade,
        r.data_validade,
        r.nao_aplica_validade
      )
      returning id into v_stock_item_id;
    else
      update public.stock_items si
      set
        quantidade = coalesce(si.quantidade, 0) + v_qty,
        quantidade_atual = coalesce(si.quantidade_atual, coalesce(si.quantidade, 0)) + v_qty,
        data_compra = p_purchase_date
      where si.id = v_stock_item_id;
    end if;

    -- Update Expiration and Catalog Learning Logic
    if r.nao_aplica_validade then
      update public.stock_items 
      set 
        validade_nao_aplica = true,
        data_validade_alerta = null,
        data_validade = null
      where id = v_stock_item_id;
      
      update public.product_catalog
      set perecivel = false
      where id = v_product_id;
    elsif r.data_validade is not null then
      update public.stock_items
      set 
        data_validade_alerta = r.data_validade,
        data_validade = r.data_validade,
        validade_nao_aplica = false
      where id = v_stock_item_id;

      -- Catalog learning: store the typical shelf life (days between purchase and expiration)
      -- so future purchases of the same product can suggest a default validity date.
      update public.product_catalog
      set validade_padrao_dias = greatest(1, (r.data_validade - p_purchase_date)::int)
      where id = v_product_id
        and (r.data_validade - p_purchase_date) > 0;
    else
      -- Neither provided and perishable: mark as pending (data_validade_alerta = NULL)
      if v_perecivel then
        update public.stock_items
        set 
          data_validade_alerta = null,
          data_validade = null
        where id = v_stock_item_id 
          and validade_nao_aplica = false;
      end if;
    end if;

    insert into public.stock_lots (
      stock_item_id,
      source_list_item_id,
      quantidade_inicial,
      quantidade_restante,
      unidade,
      custo_total,
      custo_unitario,
      fator_consumo,
      data_compra,
      data_validade,
      created_by
    )
    values (
      v_stock_item_id,
      r.id,
      v_qty,
      v_qty,
      v_unit,
      nullif(v_price_total, 0),
      v_price_unit,
      null,
      p_purchase_date,
      r.data_validade,
      v_user_id
    )
    returning id into v_lot_id;

    insert into public.stock_movements (
      item_id,
      stock_item_id,
      lot_id,
      tipo,
      quantidade,
      unidade,
      custo_unitario_ref,
      observacao,
      origem,
      source_list_id,
      source_list_item_id,
      criado_por
    )
    values (
      v_stock_item_id,
      v_stock_item_id,
      v_lot_id,
      'entrada',
      v_qty,
      v_unit,
      v_price_unit,
      'Entrada por finalização de compra',
      'list_finalize',
      p_list_id,
      r.id,
      v_user_id
    );
  end loop;

  update public.shopping_lists
  set
    ativa = false,
    status = 'closed',
    finalizada_em = now(),
    finalized_at = now(),
    closed_purchase_date = p_purchase_date,
    fechado_por = v_user_id,
    total = nullif(v_total, 0)
  where id = p_list_id;

  -- New active list logic with conflict prevention
  select sl.id
    into v_existing_active_list_id
  from public.shopping_lists sl
  where sl.group_id = v_group_id
    and sl.ativa = true
    and sl.id <> p_list_id
  order by sl.criada_em desc nulls last, sl.id desc
  limit 1;

  if v_existing_active_list_id is null then
    begin
      insert into public.shopping_lists (group_id, ativa, status)
      values (v_group_id, true, 'active')
      returning id into v_next_list_id;
    exception
      when unique_violation then
        select sl.id
          into v_next_list_id
        from public.shopping_lists sl
        where sl.group_id = v_group_id
          and sl.ativa = true
        order by sl.criada_em desc nulls last, sl.id desc
        limit 1;
    end;
  else
    v_next_list_id := v_existing_active_list_id;
  end if;

  insert into public.items (
    list_id, product_id, nome, quantidade, quantidade_raw, quantidade_num,
    unidade, categoria, comprado, preco, preco_total, preco_unitario,
    criado_por, data_validade, nao_aplica_validade
  )
  select
    v_next_list_id, i.product_id, i.nome, i.quantidade, coalesce(i.quantidade_raw, i.quantidade),
    i.quantidade_num, i.unidade, i.categoria, false, i.preco, coalesce(i.preco_total, i.preco),
    i.preco_unitario, i.criado_por, null, false
  from public.items i
  where i.list_id = p_list_id
    and i.comprado = false;

  delete from public.items where list_id = p_list_id and comprado = false;

  next_list_id := v_next_list_id;
  bought_items_count := v_bought_count;
  pending_items_count := v_pending_count;
  finalized_total := v_total;

  return next;
END;
$$;

COMMIT;


-- ====================================================================
-- Migration: 20260501100000_fix_fkey_auth_users.sql
-- ====================================================================
BEGIN;

ALTER TABLE public.stock_lots
DROP CONSTRAINT IF EXISTS stock_lots_created_by_fkey;

ALTER TABLE public.stock_lots
ADD CONSTRAINT stock_lots_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.shopping_lists
DROP CONSTRAINT IF EXISTS shopping_lists_fechado_por_fkey;

ALTER TABLE public.shopping_lists
ADD CONSTRAINT shopping_lists_fechado_por_fkey
FOREIGN KEY (fechado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;


-- ====================================================================
-- Migration: 20260501110000_rpc_bulk_validity.sql
-- ====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_bulk_update_stock_validity(
  p_item_ids uuid[],
  p_data_validade date,
  p_nao_aplica boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_item_id uuid;
  v_product_id uuid;
  v_group_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Security: verify ALL stock items belong to a group the caller is a member of.
  -- Without this check, a malicious client could pass arbitrary UUIDs and bypass RLS
  -- because SECURITY DEFINER runs with elevated privileges.
  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    SELECT group_id INTO v_group_id FROM public.stock_items WHERE id = v_item_id;
    IF v_group_id IS NULL THEN
      RAISE EXCEPTION 'Item de estoque não encontrado: %', v_item_id;
    END IF;
    IF NOT public.is_group_member(v_group_id) THEN
      RAISE EXCEPTION 'Sem permissão para item de estoque %', v_item_id;
    END IF;
  END LOOP;

  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    SELECT product_id INTO v_product_id FROM public.stock_items WHERE id = v_item_id;

    IF p_nao_aplica THEN
      UPDATE public.stock_items
      SET validade_nao_aplica = true,
          data_validade_alerta = NULL,
          data_validade = NULL
      WHERE id = v_item_id;

      IF v_product_id IS NOT NULL THEN
        UPDATE public.product_catalog SET perecivel = false WHERE id = v_product_id;
      END IF;
    ELSE
      -- Keep data_validade in sync with data_validade_alerta to avoid divergence
      -- between "the alert date" and "the actual stored expiration date".
      UPDATE public.stock_items
      SET data_validade_alerta = p_data_validade,
          data_validade = p_data_validade,
          validade_nao_aplica = false
      WHERE id = v_item_id;
    END IF;

    -- Record an informational movement. quantidade = 0 because this is a metadata
    -- adjustment (validity), not a stock change. Using quantidade_atual would inflate
    -- consumption / movement reports.
    INSERT INTO public.stock_movements (
      item_id, stock_item_id, tipo, quantidade, unidade, observacao, origem, criado_por
    )
    SELECT id, id, 'ajuste_validade_bulk', 0, unidade,
           CASE WHEN p_nao_aplica
             THEN 'Marcado como não perecível (bulk)'
             ELSE 'Ajuste de validade em lote: ' || p_data_validade::text
           END,
           'adjustment', v_user_id
    FROM public.stock_items WHERE id = v_item_id;
  END LOOP;
END;
$$;

COMMIT;


-- ====================================================================
-- Migration: 20260502000005_baseline_consume_stock_fifo.sql
-- ====================================================================
-- Baseline retroativo: consume_stock_fifo
-- Data: 2026-05-02
-- Objetivo: versionar a função de consumo FIFO que existe no banco
--           sem migration. Consome dos lotes mais antigos / mais próximos
--           de vencer primeiro. Retorna a quantidade efetivamente consumida.

begin;

create or replace function public.consume_stock_fifo(
  p_stock_item_id uuid,
  p_quantidade numeric,
  p_tipo text default 'saida',
  p_observacao text default null,
  p_origem text default 'quick_consume',
  p_criado_por uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_group_id uuid;
  v_unidade text;
  v_remaining numeric;
  v_consumed_total numeric := 0;
  v_take numeric;
  r record;
begin
  v_user_id := coalesce(p_criado_por, auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  select si.group_id, si.unidade
    into v_group_id, v_unidade
  from public.stock_items si
  where si.id = p_stock_item_id;

  if v_group_id is null then
    raise exception 'Item de estoque não encontrado: %', p_stock_item_id;
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Sem permissão para consumir este item';
  end if;

  v_remaining := p_quantidade;

  -- Itera lotes em ordem FIFO:
  --   1) lotes com data_validade mais próxima primeiro (NULLs por último)
  --   2) desempate por data_compra mais antiga
  --   3) desempate final por created_at
  for r in
    select sl.id, sl.quantidade_restante, sl.custo_unitario
    from public.stock_lots sl
    where sl.stock_item_id = p_stock_item_id
      and coalesce(sl.quantidade_restante, 0) > 0
    order by
      sl.data_validade asc nulls last,
      sl.data_compra asc nulls last,
      sl.created_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(r.quantidade_restante, v_remaining);

    update public.stock_lots
    set quantidade_restante = quantidade_restante - v_take
    where id = r.id;

    insert into public.stock_movements (
      item_id, stock_item_id, lot_id, tipo, quantidade, unidade,
      custo_unitario_ref, observacao, origem, criado_por
    )
    values (
      p_stock_item_id, p_stock_item_id, r.id, p_tipo, v_take, v_unidade,
      r.custo_unitario, p_observacao, p_origem, v_user_id
    );

    v_remaining := v_remaining - v_take;
    v_consumed_total := v_consumed_total + v_take;
  end loop;

  -- Os triggers trg_sync_stock_item_* recalculam quantidade e data_validade.
  return v_consumed_total;
end;
$$;

revoke all on function public.consume_stock_fifo(uuid, numeric, text, text, text, uuid) from public;
grant execute on function public.consume_stock_fifo(uuid, numeric, text, text, text, uuid) to authenticated;

commit;


-- ====================================================================
-- Migration: 20260502000007_fix_unit_conversion_column.sql
-- ====================================================================
-- Reconcilia divergência: product_unit_conversion.fator_consumo_padrao
-- Data: 2026-05-02
-- Objetivo: a migration 20260423_01 cria a coluna como `fator_consumo_em_estoque`,
--           mas o banco real tem `fator_consumo_padrao`. Esta migration alinha
--           ambos: renomeia para `fator_consumo_padrao` se ainda estiver
--           com o nome antigo, ou apenas cria com o nome correto se faltar.
-- Idempotente.

begin;

do $$
declare
  has_old boolean;
  has_new boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_unit_conversion'
      and column_name = 'fator_consumo_em_estoque'
  ) into has_old;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_unit_conversion'
      and column_name = 'fator_consumo_padrao'
  ) into has_new;

  if has_old and not has_new then
    alter table public.product_unit_conversion
      rename column fator_consumo_em_estoque to fator_consumo_padrao;
  elsif has_old and has_new then
    -- Banco já tem a nova; remove a antiga para evitar confusão.
    alter table public.product_unit_conversion
      drop column fator_consumo_em_estoque;
  elsif not has_old and not has_new then
    alter table public.product_unit_conversion
      add column fator_consumo_padrao numeric not null default 1;
  end if;
end
$$;

commit;


-- ====================================================================
-- Migration: 20260502000008_cleanup_duplicate_indexes_policies.sql
-- ====================================================================
-- Limpeza: índices e políticas duplicadas
-- Data: 2026-05-02
-- Objetivo: remover índices únicos e políticas RLS criadas manualmente que
--           duplicam exatamente as estruturas criadas pelas migrations
--           20260423_01 e 20260423_02. Mantém apenas as versões `ux_*`
--           (criadas pelas migrations) e a política canônica.
-- Seguro: cada DROP usa IF EXISTS.

begin;

-- =====================================================
-- 1) Índices duplicados
-- =====================================================
-- shopping_lists: idx_shopping_lists_active_group == ux_shopping_lists_group_active
drop index if exists public.idx_shopping_lists_active_group;

-- stock_items: idx_stock_items_group_product == ux_stock_items_group_product
drop index if exists public.idx_stock_items_group_product;

-- product_catalog: idx_product_catalog_unique == ux_product_catalog_group_nome_unidade
drop index if exists public.idx_product_catalog_unique;

-- =====================================================
-- 2) Política RLS duplicada em product_unit_conversion
-- =====================================================
-- "Acesso via produto" é equivalente a "product_unit_conversion_all".
drop policy if exists "Acesso via produto" on public.product_unit_conversion;

commit;


-- ====================================================================
-- Migration: 20260502000009_reapply_auth_user_fkeys.sql
-- ====================================================================
-- Reaplicação das FKs para auth.users
-- Data: 2026-05-02
-- Objetivo: a migration 20260501100000_fix_fkey_auth_users.sql está versionada
--           mas o banco real não tem essas constraints aplicadas (drift).
--           Esta migration garante o estado final desejado de forma idempotente.
-- Tabelas afetadas:
--   - public.stock_lots.created_by      → auth.users(id) ON DELETE SET NULL
--   - public.shopping_lists.fechado_por → auth.users(id) ON DELETE SET NULL

begin;

-- =====================================================
-- stock_lots.created_by
-- =====================================================
alter table public.stock_lots
  drop constraint if exists stock_lots_created_by_fkey;

alter table public.stock_lots
  add constraint stock_lots_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- =====================================================
-- shopping_lists.fechado_por
-- =====================================================
alter table public.shopping_lists
  drop constraint if exists shopping_lists_fechado_por_fkey;

alter table public.shopping_lists
  add constraint shopping_lists_fechado_por_fkey
  foreign key (fechado_por) references auth.users(id) on delete set null;

-- =====================================================
-- group_members.user_id
-- =====================================================
alter table public.group_members
  drop constraint if exists group_members_user_id_fkey;

alter table public.group_members
  add constraint group_members_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

commit;


-- ====================================================================
-- Migration: 20260502000010_legacy_cleanup_disabled.sql
-- ====================================================================
-- Limpeza de campos legados — DESABILITADA POR PADRÃO
-- Data: 2026-05-02
-- Status: ⚠️ NÃO EXECUTA NADA. Mantida como referência.
--
-- Estes drops são desejados (ver docs/database_map.md → Plano de Implementação),
-- mas removeriam colunas/colunas/FKs ainda referenciadas pelo código:
--   - stock_items.quantidade_atual  → usado em src/lib/webData.ts e em
--                                     várias RPCs (rpc_finalize_shopping_list,
--                                     20260423_03, 20260423_04, 20260425003437,
--                                     20260501_bulk_expiration_feature)
--   - stock_items.updated_at        → duplicado de atualizado_em, mas usado
--                                     pelo trigger trg_stock_items_updated_at
--   - stock_movements.item_id       → legado, ainda preenchido pela RPC e
--                                     referenciado nas políticas RLS via COALESCE
--
-- Sequência segura para futura execução:
--   1) Remover referências em src/lib/webData.ts e demais arquivos
--   2) Atualizar RPCs (rpc_finalize_shopping_list, etc.) para parar de
--      preencher essas colunas
--   3) Atualizar política RLS stock_movements_all_v2 para usar apenas
--      stock_item_id (sem COALESCE com item_id)
--   4) Remover este arquivo e gerar uma nova migration ativa com os DROPs
--
-- Para evitar execução acidental, o arquivo só contém um NO-OP.

begin;

-- NO-OP intencional. Veja cabeçalho.
select 1;

commit;

-- Drops de referência (NÃO EXECUTAR sem completar passos 1-3 acima):
--
--   alter table public.stock_items drop column if exists quantidade_atual;
--   alter table public.stock_items drop column if exists updated_at;
--   alter table public.stock_movements drop column if exists item_id;


-- ====================================================================
-- Migration: 20260503000001_fix_stock_movements_constraint.sql
-- ====================================================================
begin;

-- Remove a constraint antiga se existir (para evitar erros se já tiver outro nome ou conflito)
alter table public.stock_movements
  drop constraint if exists stock_movements_quantidade_positive;

-- Recria a constraint permitindo quantidade >= 0
-- (necessário para suportar movimentos informacionais como 'ajuste_validade_bulk' que inserem 0)
alter table public.stock_movements
  add constraint stock_movements_quantidade_positive check (quantidade >= 0);

commit;



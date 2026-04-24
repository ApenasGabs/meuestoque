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

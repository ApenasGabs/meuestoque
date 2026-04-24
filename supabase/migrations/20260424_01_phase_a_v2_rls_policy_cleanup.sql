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

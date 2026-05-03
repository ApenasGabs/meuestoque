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

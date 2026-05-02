-- Baseline retroativo das tabelas-base
-- Data: 2026-05-02
-- Objetivo: versionar a criação das tabelas que existem no banco mas nunca
--           tiveram migration neste repositório (drift histórico).
-- Idempotente: usa IF NOT EXISTS para não conflitar com bancos que já têm
--              essas estruturas. Não altera dados existentes.

begin;

create extension if not exists pgcrypto;

-- =====================================================
-- 1) profiles  (espelho de auth.users)
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key,
  nome text,
  created_at timestamptz not null default now()
);

-- FK lógica para auth.users (não declarada por questões de migração de auth no Supabase)
-- Caso queira fortalecer: alter table public.profiles
--   add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- =====================================================
-- 2) groups
-- =====================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo_convite text not null unique default substr(md5(random()::text), 1, 8),
  criado_em timestamptz default now()
);

-- =====================================================
-- 3) group_members
-- =====================================================
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid,
  entrou_em timestamptz default now(),
  unique (group_id, user_id)
);

-- =====================================================
-- 4) shopping_lists  (apenas colunas-base; ALTER TABLE adicional fica nas
--    migrations de Fase A)
-- =====================================================
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  ativa boolean default true,
  criada_em timestamptz default now(),
  finalizada_em timestamptz,
  total numeric
);

-- =====================================================
-- 5) items  (apenas colunas-base)
-- =====================================================
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references public.shopping_lists(id) on delete cascade,
  nome text not null,
  quantidade text default '1',
  categoria text,
  comprado boolean default false,
  criado_por uuid,
  criado_em timestamptz default now(),
  preco numeric
);

-- =====================================================
-- 6) stock_items  (apenas colunas-base)
-- =====================================================
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  nome text not null,
  categoria text not null default 'Outros',
  unidade text not null default 'un',
  quantidade numeric not null default 0,
  quantidade_minima numeric not null default 0,
  tamanho_porcao numeric not null default 1,
  na_lista boolean not null default false,
  auto_adicionar_lista boolean not null default false,
  consumo_frequencia text not null default 'weekly',
  consumo_valor numeric not null default 0,
  ultimo_consumo_auto_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  data_compra date,
  data_validade date
);

create index if not exists idx_stock_items_group_id on public.stock_items (group_id);
create index if not exists idx_stock_items_nome on public.stock_items (nome);
create index if not exists idx_stock_items_data_validade on public.stock_items (data_validade);

-- =====================================================
-- 7) stock_movements  (apenas colunas-base)
-- =====================================================
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items(id) on delete cascade,
  tipo text not null,
  quantidade numeric not null,
  observacao text,
  criado_por uuid,
  criado_em timestamptz not null default now()
);

create index if not exists idx_stock_movements_item_id on public.stock_movements (item_id);
create index if not exists idx_stock_movements_criado_em on public.stock_movements (criado_em desc);

commit;

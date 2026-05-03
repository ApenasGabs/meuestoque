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

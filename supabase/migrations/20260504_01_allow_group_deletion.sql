-- Migration: allow_group_deletion
-- Data: 2026-05-04
-- Objetivo: permitir que membros excluam o grupo.

begin;

-- 1. Adiciona coluna created_by
alter table public.groups add column if not exists created_by uuid;

-- 2. Popula created_by para grupos existentes (membro mais antigo)
update public.groups g
set created_by = sub.user_id
from (
	select distinct on (group_id) group_id, user_id
	from public.group_members
	order by group_id, entrou_em asc
) sub
where g.id = sub.group_id and g.created_by is null;

-- 3. Garante FK lógica (não força ON DELETE)
alter table public.groups drop constraint if exists groups_created_by_fkey;
alter table public.groups add constraint groups_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

-- 4. Policy: só o owner pode deletar
drop policy if exists groups_delete_member on public.groups;
create policy groups_delete_owner
on public.groups
for delete
to authenticated
using (created_by = auth.uid());

commit;

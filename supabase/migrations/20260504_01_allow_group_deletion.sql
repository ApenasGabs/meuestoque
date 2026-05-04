-- Migration: allow_group_deletion
-- Data: 2026-05-04
-- Objetivo: permitir que membros excluam o grupo.

begin;

drop policy if exists groups_delete_member on public.groups;
create policy groups_delete_member
on public.groups
for delete
to authenticated
using (public.is_group_member(id));

commit;

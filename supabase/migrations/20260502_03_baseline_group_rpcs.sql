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

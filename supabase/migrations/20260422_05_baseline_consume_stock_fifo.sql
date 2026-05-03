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

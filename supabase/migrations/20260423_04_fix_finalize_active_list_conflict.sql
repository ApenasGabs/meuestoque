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

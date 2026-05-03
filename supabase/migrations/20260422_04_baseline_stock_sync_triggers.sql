-- Baseline retroativo: triggers de sincronização stock_lots → stock_items
-- Data: 2026-05-02
-- Objetivo: versionar as funções/triggers que mantêm
--   stock_items.quantidade   = SUM(stock_lots.quantidade_restante)
--   stock_items.data_validade = MIN(stock_lots.data_validade)
-- Existem no banco mas não estão versionadas (drift histórico).

begin;

-- =====================================================
-- 1) Função: sync_stock_item_quantity
-- Recalcula stock_items.quantidade somando os lotes restantes.
-- =====================================================
create or replace function public.sync_stock_item_quantity()
returns trigger
language plpgsql
as $$
declare
  v_stock_item_id uuid;
begin
  v_stock_item_id := coalesce(new.stock_item_id, old.stock_item_id);
  if v_stock_item_id is null then
    return coalesce(new, old);
  end if;

  update public.stock_items si
  set quantidade = coalesce((
    select sum(coalesce(sl.quantidade_restante, 0))
    from public.stock_lots sl
    where sl.stock_item_id = v_stock_item_id
  ), 0)
  where si.id = v_stock_item_id;

  return coalesce(new, old);
end;
$$;

-- =====================================================
-- 2) Função: sync_stock_item_validade
-- Atualiza stock_items.data_validade com o MIN dos lotes ativos
-- (apenas lotes com quantidade_restante > 0 contam).
-- =====================================================
create or replace function public.sync_stock_item_validade()
returns trigger
language plpgsql
as $$
declare
  v_stock_item_id uuid;
begin
  v_stock_item_id := coalesce(new.stock_item_id, old.stock_item_id);
  if v_stock_item_id is null then
    return coalesce(new, old);
  end if;

  update public.stock_items si
  set data_validade = (
    select min(sl.data_validade)
    from public.stock_lots sl
    where sl.stock_item_id = v_stock_item_id
      and coalesce(sl.quantidade_restante, 0) > 0
      and sl.data_validade is not null
  )
  where si.id = v_stock_item_id;

  return coalesce(new, old);
end;
$$;

-- =====================================================
-- 3) Função: set_atualizado_em_stock_items
-- Mantém stock_items.atualizado_em ao mudar a linha.
-- (Convive com trg_stock_items_updated_at que cuida de updated_at.)
-- =====================================================
create or replace function public.set_atualizado_em_stock_items()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- =====================================================
-- 4) Triggers em stock_lots
-- =====================================================
drop trigger if exists trg_sync_stock_item_quantity on public.stock_lots;
create trigger trg_sync_stock_item_quantity
after insert or update or delete on public.stock_lots
for each row
execute function public.sync_stock_item_quantity();

drop trigger if exists trg_sync_stock_item_validade on public.stock_lots;
create trigger trg_sync_stock_item_validade
after insert or update or delete on public.stock_lots
for each row
execute function public.sync_stock_item_validade();

-- =====================================================
-- 5) Trigger em stock_items
-- =====================================================
drop trigger if exists trg_set_atualizado_em_stock_items on public.stock_items;
create trigger trg_set_atualizado_em_stock_items
before update on public.stock_items
for each row
execute function public.set_atualizado_em_stock_items();

commit;

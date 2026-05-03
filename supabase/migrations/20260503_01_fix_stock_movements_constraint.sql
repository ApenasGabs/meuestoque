begin;

-- Remove a constraint antiga se existir (para evitar erros se já tiver outro nome ou conflito)
alter table public.stock_movements
  drop constraint if exists stock_movements_quantidade_positive;

-- Recria a constraint permitindo quantidade >= 0
-- (necessário para suportar movimentos informacionais como 'ajuste_validade_bulk' que inserem 0)
alter table public.stock_movements
  add constraint stock_movements_quantidade_positive check (quantidade >= 0);

commit;

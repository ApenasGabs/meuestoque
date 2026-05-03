-- Reconcilia divergência: product_unit_conversion.fator_consumo_padrao
-- Data: 2026-05-02
-- Objetivo: a migration 20260423_01 cria a coluna como `fator_consumo_em_estoque`,
--           mas o banco real tem `fator_consumo_padrao`. Esta migration alinha
--           ambos: renomeia para `fator_consumo_padrao` se ainda estiver
--           com o nome antigo, ou apenas cria com o nome correto se faltar.
-- Idempotente.

begin;

do $$
declare
  has_old boolean;
  has_new boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_unit_conversion'
      and column_name = 'fator_consumo_em_estoque'
  ) into has_old;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_unit_conversion'
      and column_name = 'fator_consumo_padrao'
  ) into has_new;

  if has_old and not has_new then
    alter table public.product_unit_conversion
      rename column fator_consumo_em_estoque to fator_consumo_padrao;
  elsif has_old and has_new then
    -- Banco já tem a nova; remove a antiga para evitar confusão.
    alter table public.product_unit_conversion
      drop column fator_consumo_em_estoque;
  elsif not has_old and not has_new then
    alter table public.product_unit_conversion
      add column fator_consumo_padrao numeric not null default 1;
  end if;
end
$$;

commit;

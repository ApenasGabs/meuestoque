-- Baseline retroativo: stock_items.pack_size / pack_label
-- Data: 2026-05-02
-- Objetivo: versionar as colunas que existem no banco mas não foram criadas
--           por nenhuma migration. Permitem registrar a embalagem padrão
--           (ex: pack_size = 5, pack_label = 'kg').

begin;

alter table public.stock_items
  add column if not exists pack_size numeric,
  add column if not exists pack_label text;

commit;

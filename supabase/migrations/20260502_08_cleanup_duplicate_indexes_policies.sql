-- Limpeza: índices e políticas duplicadas
-- Data: 2026-05-02
-- Objetivo: remover índices únicos e políticas RLS criadas manualmente que
--           duplicam exatamente as estruturas criadas pelas migrations
--           20260423_01 e 20260423_02. Mantém apenas as versões `ux_*`
--           (criadas pelas migrations) e a política canônica.
-- Seguro: cada DROP usa IF EXISTS.

begin;

-- =====================================================
-- 1) Índices duplicados
-- =====================================================
-- shopping_lists: idx_shopping_lists_active_group == ux_shopping_lists_group_active
drop index if exists public.idx_shopping_lists_active_group;

-- stock_items: idx_stock_items_group_product == ux_stock_items_group_product
drop index if exists public.idx_stock_items_group_product;

-- product_catalog: idx_product_catalog_unique == ux_product_catalog_group_nome_unidade
drop index if exists public.idx_product_catalog_unique;

-- =====================================================
-- 2) Política RLS duplicada em product_unit_conversion
-- =====================================================
-- "Acesso via produto" é equivalente a "product_unit_conversion_all".
drop policy if exists "Acesso via produto" on public.product_unit_conversion;

commit;

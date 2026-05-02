-- Limpeza de campos legados — DESABILITADA POR PADRÃO
-- Data: 2026-05-02
-- Status: ⚠️ NÃO EXECUTA NADA. Mantida como referência.
--
-- Estes drops são desejados (ver docs/database_map.md → Plano de Implementação),
-- mas removeriam colunas/colunas/FKs ainda referenciadas pelo código:
--   - stock_items.quantidade_atual  → usado em src/lib/webData.ts e em
--                                     várias RPCs (rpc_finalize_shopping_list,
--                                     20260423_03, 20260423_04, 20260425003437,
--                                     20260501_bulk_expiration_feature)
--   - stock_items.updated_at        → duplicado de atualizado_em, mas usado
--                                     pelo trigger trg_stock_items_updated_at
--   - stock_movements.item_id       → legado, ainda preenchido pela RPC e
--                                     referenciado nas políticas RLS via COALESCE
--
-- Sequência segura para futura execução:
--   1) Remover referências em src/lib/webData.ts e demais arquivos
--   2) Atualizar RPCs (rpc_finalize_shopping_list, etc.) para parar de
--      preencher essas colunas
--   3) Atualizar política RLS stock_movements_all_v2 para usar apenas
--      stock_item_id (sem COALESCE com item_id)
--   4) Remover este arquivo e gerar uma nova migration ativa com os DROPs
--
-- Para evitar execução acidental, o arquivo só contém um NO-OP.

begin;

-- NO-OP intencional. Veja cabeçalho.
select 1;

commit;

-- Drops de referência (NÃO EXECUTAR sem completar passos 1-3 acima):
--
--   alter table public.stock_items drop column if exists quantidade_atual;
--   alter table public.stock_items drop column if exists updated_at;
--   alter table public.stock_movements drop column if exists item_id;

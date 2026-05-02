# 0001 — Persistir flag `validade_nao_aplica` por item de estoque

- **Status:** Aceita
- **Autores:** @Apenasgabs

## Contexto

Itens claramente não-perecíveis (sabão, detergente) sempre apareciam como Pendente Validade, gerando fricção. Precisávamos:

1. Marcar dispensa de validade sem perder auditabilidade.
2. Aplicar a marca em massa.
3. Permitir que o catálogo aprenda automaticamente.

## Decisão

Persistir em **dois níveis**:

- Por item: `stock_items.validade_nao_aplica` (e `items.nao_aplica_validade` no pré-checkout).
- Globalmente: `product_catalog.perecivel` (default `true`). Marcar Não se aplica seta `false` (catalog learning).

UI permite reverter via `ProductFormModal` (undo).

## Consequências

- Filtros e alertas respeitam `validade_nao_aplica`.
- `rpc_finalize_shopping_list` e `rpc_bulk_update_stock_validity` atualizam ambos os níveis.
- `stock_movements` mantém trilha de auditoria com `quantidade = 0`.
- Risco: marcação acidental. Mitigado por undo + bloqueio de categorias incompatíveis.

## Alternativas consideradas

- **Categoria mágica Não Perecível**: rejeitada por acoplar UX a categoria.
- **Ocultar só na UI**: rejeitada por gerar dívida nos dados.

## Referências

- `supabase/migrations/20260501_bulk_expiration_feature.sql`
- `supabase/migrations/20260501110000_rpc_bulk_validity.sql`
- [`docs/ai/feature-bulk-expiration.md`](../ai/feature-bulk-expiration.md)

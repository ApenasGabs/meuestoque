# Glossário

Termos recorrentes no domínio do Meu Estoque.

## A

**ActionBar (Bulk Mode)** — barra fixa no rodapé com ações em massa (Definir Validade, Não se aplica).

**Ajuste de validade em lote** (`ajuste_validade_bulk`) — tipo de movimento em `stock_movements` com `quantidade = 0`, registrando ajuste de validade sem alterar estoque.

## B

**Bulk Mode** — estado de seleção múltipla com escopo `inventory` ou `shopping_list`.

## C

**Catalog Learning** — sistema atualiza `product_catalog` automaticamente: `perecivel = false` ao marcar Não se aplica; `validade_padrao_dias` baseado na diferença entre compra e validade.

**Chip** — filtro visual com seleção múltipla (substitui dropdowns).

## F

**FIFO (lots)** — consumo deduz primeiro do lote mais antigo / mais próximo de vencer.

## L

**Lista Ativa** — `shopping_list` com `status = 'active'`. Uma por grupo.

**Long Press** — toque longo (>=500ms) ou clique direito que ativa o Bulk Mode.

## N

**Não se aplica (validade)** — flag `validade_nao_aplica` que dispensa controle de validade. Em massa também atualiza `product_catalog.perecivel`.

## P

**Pendente Validade** — item perecível sem data, fixado no topo do estoque.

**Perecível** — `product_catalog.perecivel`, default `true`.

## R

**RPC** — função armazenada no Postgres invocada via `supabase.rpc()`. Lista em [`docs/ai/04_RPC_CONTRACTS.md`](./ai/04_RPC_CONTRACTS.md).

## S

**Smart List** — geração automática a partir de itens abaixo do mínimo.

**Stock Lot** — lote físico com data de validade e custo independentes.

## U

**Unidade Composta** — produto cuja unidade de compra difere da unidade de consumo.

## Z

**Zero Fricção** — UX cobra dados visualmente sem bloquear o fluxo do usuário.

# Funcionalidades do Meu Estoque

Este documento descreve em detalhe **o que** o sistema faz, do ponto de vista de produto e de negócio. Para detalhes de implementação técnica, veja:

- Arquitetura e dados: [`docs/ai/01_ARCHITECTURE_AND_DATA.md`](./ai/01_ARCHITECTURE_AND_DATA.md)
- UX e regras: [`docs/ai/02_UX_AND_BUSINESS_RULES.md`](./ai/02_UX_AND_BUSINESS_RULES.md)
- Componentes: [`docs/ai/03_COMPONENTS.md`](./ai/03_COMPONENTS.md)
- Contratos de RPC: [`docs/ai/04_RPC_CONTRACTS.md`](./ai/04_RPC_CONTRACTS.md)
- Mapa do banco: [`docs/ai/05_DATABASE_MAP.md`](./ai/05_DATABASE_MAP.md)

## 1. Autenticação e Perfil

- Registro e login com e-mail/senha gerenciados pelo Supabase Auth.
- Perfil de exibição editável.

## 2. Grupos (Residências)

O sistema é multi-inquilino com base em `groups`:

- Criação de grupo gera código de convite único.
- Entrada via código de convite.
- Membros visíveis a todos no grupo.
- Toda operação obedece RLS por `group_members`.

## 3. Controle de Estoque

- Cadastro de produtos (nome, categoria, quantidade atual, mínima, unidade).
- Categorização por chips (Hortifruti, Carnes, Laticínios, Limpeza, Grãos, Outros).
- Movimentações registradas em `stock_movements` (entrada, saída, ajuste, consumo automático, ajuste de validade em lote).
- Alerta de estoque baixo destaca produtos abaixo do mínimo.
- Gestão de validade _zero fricção_: itens sem validade são fixados no topo até o usuário definir uma data ou marcar como **Não se aplica**.
- Conversão de unidades: comprar por kg / pacote e consumir por unidade.

## 4. Lista de Compras

- Lista ativa única por grupo.
- Parser inteligente em texto livre (`Nome, quantidade, valor`).
- Lista inteligente: gera entradas para itens abaixo do mínimo.
- Importação de recibo (Tenda, Pague Menos).
- Preço total ou por unidade, com alerta de preço antigo (>30 dias).
- Finalização processa itens marcados, atualiza estoque, cria lotes em `stock_lots`.
- Itens não comprados migram para a próxima lista ativa.
- Suporta definir `data_validade` ou `nao_aplica_validade` por item antes do checkout.

## 5. Validade em Massa (Bulk Expiration)

Detalhes completos em [`docs/ai/feature-bulk-expiration.md`](./ai/feature-bulk-expiration.md).

- Long-press em qualquer card ativa o **Bulk Mode** (escopo `inventory` ou `shopping_list`).
- Action bar inferior oferece **Definir Validade** ou **Não se aplica**.
- Detecta categorias incompatíveis e desabilita Não se aplica.
- Sugere Recomendado quando >=80% dos selecionados são da categoria Limpeza.
- Conflitos de data abrem warning com escolha entre sobrescrever ou aplicar somente aos sem data.
- Marcação como não perecível atualiza `product_catalog.perecivel = false` (catalog learning).
- Undo disponível no `ProductFormModal`.

## 6. Histórico e Finanças

- Listas finalizadas com totais.
- Ajuste retroativo da data da compra.
- Movimentações auditáveis em `stock_movements`.

## 7. Diferenciais Técnicos

- Zustand com persistência local.
- Realtime via Supabase Channels.
- UX otimizada para mobile.

---

_Última revisão: alinhada à branch `docs/restructure`. Use o histórico Git como fonte de verdade._

# 📚 01: Arquitetura e Modelo de Dados

Este documento reflete a estrutura do banco de dados e arquitetura da aplicação como ela **realmente está implementada**, com ênfase nas migrações do "Modelo V2" e Integração Supabase.

## Visão Geral do Banco de Dados (Supabase)

A aplicação utiliza o Supabase para backend as a service, provendo Auth e Banco de Dados (PostgreSQL). O modelo foi evoluído para suportar rastreabilidade completa e conversão de unidades (ex: comprar por quilo, consumir por unidade).

### Tabelas Principais

1. **`product_catalog`**: O catálogo mestre de produtos de um grupo.
   - Todo item adicionado gera uma entrada única de (nome, unidade) aqui.
   - Contém a "porção padrão" consumida e o tipo da unidade (`simple` ou `composite`).
   - Flag `perecivel` (boolean) usada para aprendizado automático (ex: itens de limpeza não expiram).

2. **`stock_items`**: O estoque consolidado.
   - Reflete a *quantidade atual* em estoque de um produto em um grupo.
   - Contém alertas de vencimento (`data_validade_alerta`) e flags de auto-adição à lista (`auto_adicionar_lista`).
   - Flag `validade_nao_aplica` permite dispensar validade para um item de estoque específico.

3. **`shopping_lists` e `items`**:
   - Uma *lista de compras ativa* por grupo (status: `active`).
   - Itens agora suportam a definição prévia de `data_validade` ou `nao_aplica_validade` antes mesmo do fechamento da lista.
   - Ao finalizar compras, os itens marcados vão para o estoque, a lista atual vira `closed`, e uma nova lista `active` é gerada com os itens pendentes.

4. **`stock_lots`**: Lotes de compra (Rastreabilidade Financeira).
   - Registra o histórico de quanto custou cada lote e data da compra.
   - Fator de conversão por lote (ex: este tomate pesou 285g por unidade).

5. **`stock_movements`**: Auditoria.
   - Toda entrada, saída, consumo ou ajuste gera um registro detalhado de movimentação.

## Fluxo Transacional (RPC)

A finalização da lista de compras é a operação mais complexa do sistema e roda inteiramente dentro de uma transação no banco através da RPC `rpc_finalize_shopping_list`.

**Passos executados atomicamente:**
1. Trava a lista atual e a marca como fechada (`status = 'closed'`).
2. Varre os itens comprados (`comprado = true`).
3. Encontra ou cria a referência no `product_catalog`.
4. Atualiza ou insere o registro agregado em `stock_items`.
5. Insere o lote financeiro em `stock_lots`.
6. Grava a auditoria em `stock_movements`.
7. Cria a nova lista `active` e migra os itens não comprados.

## Row Level Security (RLS)

O sistema utiliza a tabela `group_members` para o isolamento multi-tenant.
- Quase todas as queries na web passam pelas regras RLS baseadas em: `is_group_member(group_id)`.
- *Qualquer operação de banco deve sempre referenciar ou estar conectada (via Join implicito pelo Supabase) ao `group_id` em que o usuário está atuando.*

## Persistência e Zustand (Web)

O projeto React (Frontend Web) interage com o Supabase através da camada `src/lib/webData.ts` combinada com o estado global no Zustand (`src/stores/stockStore.ts`).

- As operações tentam usar as RPCs do Supabase quando disponíveis (como `rpc_finalize_shopping_list`).
- Na ausência da RPC, ou para operações simples, a API RESTful do Supabase (`supabase.from(...)`) é usada para inserir ou atualizar linhas diretamente.

# 04: Contratos de RPC (Postgres Functions)

Lista canônica das funções armazenadas usadas pela aplicação.

## `is_group_member(group_id uuid) -> boolean`

Helper de RLS. Retorna `true` se o `auth.uid()` é membro do grupo.

- Uso: policies RLS de tabelas multi-tenant.
- Idempotente.
- `SECURITY DEFINER`.

## `rpc_finalize_shopping_list(p_list_id uuid, p_purchase_date date) -> table`

Finaliza uma lista de compras transacionalmente.

### Parâmetros

| Nome | Tipo | Descrição |
|---|---|---|
| `p_list_id` | `uuid` | Lista alvo (`status = 'active'`). |
| `p_purchase_date` | `date` | Data efetiva. Default: hoje. |

### Retorno

| Coluna | Tipo |
|---|---|
| `next_list_id` | `uuid` |
| `bought_items_count` | `integer` |
| `pending_items_count` | `integer` |
| `finalized_total` | `numeric` |

### Efeitos

1. Trava a lista (`FOR UPDATE`) e marca como `closed`.
2. Para cada item comprado:
   - Resolve/insere em `product_catalog`.
   - Upsert em `stock_items`.
   - Aplica regra de validade (não se aplica / data informada / pendente perecível).
   - Cria `stock_lots`.
   - Cria `stock_movements` (`tipo='entrada'`, `origem='list_finalize'`).
3. Cria nova lista `active` (ou reaproveita).
4. Migra itens não comprados.

### Erros

- `Usuário não autenticado`.
- `Lista não encontrada`.
- `Sem permissão para finalizar lista deste grupo`.
- `Lista já não está ativa`.

## `rpc_bulk_update_stock_validity(p_item_ids uuid[], p_data_validade date, p_nao_aplica boolean) -> void`

Atualização em massa de validade.

### Parâmetros

| Nome | Tipo | Descrição |
|---|---|---|
| `p_item_ids` | `uuid[]` | UUIDs em `stock_items`. |
| `p_data_validade` | `date` | Nova data (ignorado se `p_nao_aplica`). |
| `p_nao_aplica` | `boolean` | Marca como não perecível. |

### Validações de segurança

- Exige `auth.uid()` não-nulo.
- Verifica `is_group_member()` para cada UUID. Falha encerra a transação.

### Efeitos

- `p_nao_aplica = true`: zera `data_validade*`, seta `validade_nao_aplica = true`, atualiza `product_catalog.perecivel = false`.
- `p_nao_aplica = false`: grava `data_validade_alerta` e `data_validade` em sincronia.
- Sempre insere `stock_movements` com `tipo = 'ajuste_validade_bulk'`, `quantidade = 0`.

### Erros

- `Usuário não autenticado`.
- `Item de estoque não encontrado: <uuid>`.
- `Sem permissão para item de estoque <uuid>`.

## Convenções

Toda RPC nova deve:

1. Ser registrada aqui.
2. Usar `SECURITY DEFINER` apenas quando necessário.
3. Validar `is_group_member()` para dado multi-tenant recebido.
4. Definir `SET search_path = public`.
5. Vir em uma migration versionada.

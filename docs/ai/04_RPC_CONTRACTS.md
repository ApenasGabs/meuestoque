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


## MCP API Keys (`20261012_01_mcp_api_keys.sql`)

Todas `SECURITY DEFINER` com `SET search_path = ''` (mais restrito que a convenção geral; nomes totalmente qualificados). Ver `docs/features/feature-mcp-persistent-tokens.md`.

### `create_mcp_api_key(p_name text, p_days int = 90, p_scopes text[] = '{read,write}')`

- **Grant:** `authenticated`.
- **Retorno:** `table(id uuid, api_key text, key_prefix text, expires_at timestamptz)`. `api_key` só é retornada aqui.
- **Validações:** `auth.uid()` não-nulo; `p_days` entre 1 e 365; nome de 1 a 60 caracteres; no máximo 10 chaves ativas.
- **Erros:** `not authenticated`, `p_days must be between 1 and 365`, `invalid name`, `active key limit reached`.

### `revoke_mcp_api_key(p_id uuid) -> boolean` / `revoke_all_mcp_api_keys() -> integer`

- **Grant:** `authenticated`. Só afeta linhas com `user_id = auth.uid()`. Efeito imediato no MCP.

### `exchange_mcp_api_key(p_key text)`

- **Grant:** `anon`, `authenticated` (chamada por `src/mcp/auth.ts` com a anon key).
- **Retorno:** `table(access_token text, user_id uuid, scopes text[])` com JWT HS256 de 5 min (`role=authenticated`, `aud=authenticated`, `sub`, `mcp_key_id`, `mcp_scopes`), ou **nenhuma linha** em qualquer falha (formato, inexistente, revogada, expirada, secret ausente).
- **Efeitos:** atualiza `last_used_at` no máximo a cada 5 min.
- **Dependência:** segredo `mcp_jwt_secret` no Supabase Vault.

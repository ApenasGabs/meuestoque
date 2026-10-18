# 05: Mapa do Banco de Dados

Índice e cross-link para o mapa detalhado em [`docs/database_map.md`](../database_map.md), que contém:

- Diagrama ER completo (Mermaid).
- Status por coluna (✅ usado, 🟡 parcial, 🔴 dead column).
- Comparação fluxo atual vs. ideal para preço, lotes e movimentações.

## Trechos relevantes para Bulk Expiration

| Tabela | Coluna | Status | Observação |
|---|---|---|---|
| `product_catalog` | `perecivel` | ✅ | Catalog learning ajusta ao marcar Não se aplica. |
| `product_catalog` | `validade_padrao_dias` | 🟡 | Gravado na finalização; ainda não consumido pela UI. |
| `stock_items` | `data_validade_alerta` | ✅ | Atualizado pela RPC bulk e na finalização. |
| `stock_items` | `validade_nao_aplica` | ✅ | Flag persistente. |
| `items` | `data_validade` | ✅ | Definida na lista antes do checkout. |
| `items` | `nao_aplica_validade` | ✅ | Marca pré-checkout. |
| `stock_movements` | `ajuste_validade_bulk` | ✅ | Movimento informativo (`quantidade = 0`). |

## Cross-links

- Arquitetura: [`01_ARCHITECTURE_AND_DATA.md`](./01_ARCHITECTURE_AND_DATA.md).
- RPCs: [`04_RPC_CONTRACTS.md`](./04_RPC_CONTRACTS.md).
- Feature: [`feature-bulk-expiration.md`](./feature-bulk-expiration.md).


## `mcp_api_keys` (issue #36)

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK `auth.users` | cascade |
| `name` | text | 1 a 60 chars |
| `key_prefix` | text | 15 primeiros chars, exibição |
| `key_hash` | text unique | sha256 hex; sem SELECT para `authenticated` |
| `scopes` | text[] | subset de `{read,write}` |
| `created_at` / `last_used_at` / `expires_at` / `revoked_at` | timestamptz | `expires_at` obrigatório, no máximo 366 dias |

RLS: apenas `SELECT` do próprio usuário. Escritas somente via RPCs (`04_RPC_CONTRACTS.md`).

# Plano de Acao: Servidor MCP para o MeuEstoque

> **Para o agente executor:** Leia este documento inteiro antes de tocar em qualquer arquivo.
> Leia tambem obrigatoriamente: `AI_KNOWLEDGE_BASE.md`, `.github/copilot-instructions.md`, `docs/ai/01_ARCHITECTURE_AND_DATA.md` e `docs/ai/04_RPC_CONTRACTS.md`.

---

## Contexto do Projeto

**MeuEstoque** e uma SPA React 19 + TypeScript 5 hospedada na Vercel. O backend e 100% Supabase (Postgres + Auth + RLS). O objetivo e implementar um servidor MCP que permita agentes de IA interagirem com a lista de compras, estoque, e dados de analise.

### Stack relevante para o MCP
- Vercel Serverless Functions (`api/`) — padrao ja em uso (`api/tenda.ts`)
- `@supabase/supabase-js` v2 — ja instalado
- Supabase Auth com JWT — autenticacao padrao do app
- RLS (`is_group_member(group_id)`) — protecao automatica de dados multi-tenant
- RPCs existentes: `rpc_finalize_shopping_list`, `consume_stock_fifo`, `rpc_bulk_update_stock_validity`

### Padroes obrigatorios (copilot-instructions.md)
- Apenas **arrow functions** — nunca `function`
- Sem `any` — usar `unknown` se necessario
- `data-testid` em elementos interativos (N/A para servidor MCP, mas aplicar em docs)
- Commits apenas com aprovacao explicita do usuario
- Zero erros de lint e TypeScript antes de finalizar

---

## Arquitetura do Servidor MCP

```
POST https://<dominio>.vercel.app/api/mcp
  └── api/mcp.ts          ← Entry point Vercel Serverless Function
       └── src/mcp/
            ├── server.ts         ← Instancia do McpServer com todas as tools
            ├── auth.ts           ← Middleware JWT: valida token e retorna cliente Supabase autenticado
            └── tools/
                 ├── list.ts      ← Tools de lista de compras
                 ├── stock.ts     ← Tools de estoque
                 └── insights.ts  ← Analises e relatorios
```

### Fluxo de uma chamada MCP

```
Agente IA
  → POST /api/mcp
  → Header: Authorization: Bearer <JWT do usuario>
  → Body: { method: "tools/call", params: { name: "add_item_to_list", arguments: {...} } }

api/mcp.ts
  → Extrai JWT do header Authorization
  → auth.ts: createClient do Supabase com o JWT (nao usa service_role!)
  → Supabase valida o JWT e ativa o contexto RLS do usuario
  → Tool executa query — RLS garante isolamento do grupo automaticamente
  → Retorna resultado MCP formatado
```

> **Seguranca critica:** NUNCA usar `SUPABASE_SERVICE_ROLE_KEY` no servidor MCP exposto publicamente.
> Sempre usar o JWT do cliente para que o RLS proteja os dados por `group_id`.

---

## Fase 1: Instalacao e Infraestrutura

### 1.1 Instalar dependencias

```bash
npm install mcp-handler zod
```

- `mcp-handler`: wrapper que torna MCP compativel com Vercel Serverless (Streamable HTTP)
- `zod`: validacao de schemas dos parametros das tools

> Verificar se `zod` ja esta no projeto antes de instalar.

### 1.2 Variaveis de ambiente

Adicionar ao `.env` e ao `.env.example`:

```bash
# MCP Server — Supabase (sem VITE_ pois e server-side)
SUPABASE_URL=<mesma URL do VITE_SUPABASE_URL>
SUPABASE_ANON_KEY=<mesma key do VITE_SUPABASE_ANON_KEY>
```

> Adicionar tambem no painel da Vercel em Settings > Environment Variables.

**Por que variaveis separadas?**
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` sao bundled no cliente (Vite).
- `api/mcp.ts` roda no Node.js da Vercel e usa `process.env`, nao `import.meta.env`.

### 1.3 Atualizar `vercel.json`

Adicionar rota para o MCP server:

```json
{
  "rewrites": [
    { "source": "/api/tenda/:path*", "destination": "/api/tenda?path=:path*" },
    { "source": "/((?!api/).*)", "destination": "/" }
  ],
  "ignoreCommand": "if [ \"$VERCEL_ENV\" = \"production\" ]; then exit 0; else exit 1; fi"
}
```

> Nenhuma mudanca necessaria no `vercel.json` — a rota `/api/mcp` ja e detectada automaticamente pelo Vercel porque o arquivo `api/mcp.ts` existe.

---

## Fase 2: Middleware de Autenticacao

### Arquivo: `src/mcp/auth.ts`

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

export interface AuthenticatedContext {
  supabase: SupabaseClient;
  userId: string;
  groupId: string | null;
}

/**
 * Valida o JWT Bearer do header Authorization e retorna um cliente Supabase
 * autenticado com o contexto do usuario. O RLS e ativado automaticamente.
 *
 * @param authHeader - Valor do header Authorization (ex: "Bearer eyJ...")
 * @returns Contexto autenticado com cliente Supabase e userId
 * @throws {Error} Se o token for invalido ou ausente
 */
export const authenticateRequest = async (authHeader: string | null): Promise<AuthenticatedContext> => {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authorization header ausente ou invalido");
  }

  const token = authHeader.slice(7);

  // Cria cliente com o JWT do usuario — ativa RLS automaticamente
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  // Valida o token e recupera o usuario
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Token invalido ou expirado");
  }

  // Busca o grupo ativo do usuario (primeiro grupo encontrado)
  const { data: memberData } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    groupId: memberData?.group_id ?? null,
  };
};
```

---

## Fase 3: Tools de Lista de Compras

### Arquivo: `src/mcp/tools/list.ts`

Implementar as seguintes tools com Zod schemas:

#### `get_shopping_list`
- **Descricao:** Retorna todos os itens da lista de compras ativa do grupo
- **Parametros:** nenhum (usa contexto autenticado)
- **Query:** `shopping_lists` (ativa=true) + `items` join
- **Fonte no projeto:** `loadActiveList()` + `loadListItems()` em `src/lib/webData.ts`
- **Retorno:** Lista de itens com `id, nome, quantidade, categoria, comprado, preco`

#### `add_item_to_list`
- **Descricao:** Adiciona um item na lista ativa
- **Parametros Zod:**
  ```typescript
  z.object({
    nome: z.string().min(1),
    quantidade: z.string().default("1"),    // ex: "2 kg", "3 Un"
    categoria: z.string().default("Outros"),
    preco: z.number().optional(),
  })
  ```
- **Logica:** Chamar `ensureActiveListForGroup(groupId)` para garantir lista ativa, depois inserir em `items`
- **Fonte:** `addListItem()` em `src/lib/webData.ts` (linhas 267-289)
- **Nota:** Replicar a logica de parse de quantidade (`parseListQuantityLabel`) e extracao de marca (`extractProductParts`)

#### `remove_item_from_list`
- **Descricao:** Remove um item da lista pelo ID
- **Parametros Zod:**
  ```typescript
  z.object({ item_id: z.string().uuid() })
  ```
- **Fonte:** `deleteListItem()` em `src/lib/webData.ts`

#### `mark_item_as_bought`
- **Descricao:** Marca/desmarca um item como comprado e opcionalmente registra o preco
- **Parametros Zod:**
  ```typescript
  z.object({
    item_id: z.string().uuid(),
    comprado: z.boolean().default(true),
    preco: z.number().optional(),
  })
  ```
- **Fonte:** `toggleListItemPurchased()` + `updateListItemPrice()` em `src/lib/webData.ts`

#### `finalize_shopping_list`
- **Descricao:** Finaliza a lista ativa e move itens comprados para o estoque. Cria nova lista ativa.
- **Parametros Zod:**
  ```typescript
  z.object({
    list_id: z.string().uuid(),
    data_compra: z.string().optional(), // YYYY-MM-DD, default: hoje
  })
  ```
- **Logica:** Chamar RPC `rpc_finalize_shopping_list` diretamente:
  ```typescript
  supabase.rpc("rpc_finalize_shopping_list", {
    p_list_id: list_id,
    p_purchase_date: data_compra ?? new Date().toISOString().slice(0, 10),
  })
  ```
- **Retorno:** `{ next_list_id, bought_items_count, pending_items_count, finalized_total }`

---

## Fase 4: Tools de Estoque

### Arquivo: `src/mcp/tools/stock.ts`

#### `get_stock_items`
- **Descricao:** Lista todos os itens do estoque com quantidades
- **Parametros Zod:**
  ```typescript
  z.object({
    filtro: z.enum(["todos", "baixo", "vencendo", "zerado"]).default("todos"),
    dias_vencimento: z.number().int().default(7), // para filtro "vencendo"
  })
  ```
- **Query base:**
  ```sql
  SELECT id, nome, categoria, quantidade, quantidade_minima, unidade,
         data_validade_alerta, auto_adicionar_lista, validade_nao_aplica
  FROM stock_items
  WHERE group_id = <group_id>  -- RLS garante isso automaticamente
  ```
- **Filtros aplicados no servidor:**
  - `"baixo"`: `quantidade <= quantidade_minima`
  - `"vencendo"`: `data_validade_alerta <= NOW() + INTERVAL '<dias> days'`
  - `"zerado"`: `quantidade <= 0`

#### `consume_stock_item`
- **Descricao:** Registra o consumo de um item do estoque (subtrai quantidade)
- **Parametros Zod:**
  ```typescript
  z.object({
    item_id: z.string().uuid(),
    quantidade: z.number().positive(),
  })
  ```
- **Logica:** Chamar RPC `consume_stock_fifo` diretamente:
  ```typescript
  supabase.rpc("consume_stock_fifo", {
    p_item_id: item_id,
    p_quantidade: quantidade,
    p_user_id: userId,
  })
  ```
- **Nota:** Verificar assinatura exata da RPC no banco antes de implementar

#### `get_expiring_items`
- **Descricao:** Lista itens que vencem nos proximos N dias
- **Parametros Zod:**
  ```typescript
  z.object({ dias: z.number().int().min(1).max(90).default(7) })
  ```
- **Query:**
  ```sql
  SELECT nome, quantidade, unidade, data_validade_alerta
  FROM stock_items
  WHERE data_validade_alerta IS NOT NULL
    AND data_validade_alerta <= CURRENT_DATE + INTERVAL '<dias> days'
    AND validade_nao_aplica = false
  ORDER BY data_validade_alerta ASC
  ```

#### `get_low_stock_items`
- **Descricao:** Lista itens abaixo da quantidade minima configurada
- **Parametros:** nenhum
- **Query:**
  ```sql
  SELECT nome, quantidade, quantidade_minima, unidade, categoria
  FROM stock_items
  WHERE quantidade <= quantidade_minima
    AND quantidade_minima > 0
  ORDER BY (quantidade_minima - quantidade) DESC
  ```

---

## Fase 5: Tools de Insights e Analises

### Arquivo: `src/mcp/tools/insights.ts`

#### `get_consumption_history`
- **Descricao:** Historico de consumo de um produto (ou todos) nos ultimos N dias
- **Parametros Zod:**
  ```typescript
  z.object({
    produto: z.string().optional(),  // null = todos os produtos
    dias: z.number().int().default(30),
  })
  ```
- **Query:**
  ```sql
  SELECT sm.criado_em, si.nome, si.unidade, sm.quantidade, sm.tipo
  FROM stock_movements sm
  JOIN stock_items si ON sm.item_id = si.id
  WHERE sm.tipo = 'consumo'
    AND sm.criado_em >= NOW() - INTERVAL '<dias> days'
    -- AND si.nome ILIKE '%<produto>%'  -- se filtro de produto informado
  ORDER BY sm.criado_em DESC
  LIMIT 100
  ```

#### `get_spending_summary`
- **Descricao:** Resumo de gastos em um periodo (baseado em `stock_lots`)
- **Parametros Zod:**
  ```typescript
  z.object({
    de: z.string(), // YYYY-MM-DD
    ate: z.string(), // YYYY-MM-DD
  })
  ```
- **Query:**
  ```sql
  SELECT
    si.categoria,
    SUM(sl.custo_total) AS total_gasto,
    COUNT(*) AS num_compras
  FROM stock_lots sl
  JOIN stock_items si ON sl.item_id = si.id
  WHERE sl.data_compra BETWEEN '<de>' AND '<ate>'
  GROUP BY si.categoria
  ORDER BY total_gasto DESC
  ```

#### `get_price_trend`
- **Descricao:** Tendencia de preco de um produto nas cotacoes Tenda
- **Parametros Zod:**
  ```typescript
  z.object({
    produto: z.string().min(1),
    dias: z.number().int().default(30),
  })
  ```
- **Query:** Tabela `store_price_history` (criada na Fase 3 do historico de cotacoes):
  ```sql
  SELECT data_cotacao, preco, loja_nome, filial_id
  FROM store_price_history
  WHERE produto_nome ILIKE '%<produto>%'
    AND data_cotacao >= CURRENT_DATE - INTERVAL '<dias> days'
  ORDER BY data_cotacao DESC
  LIMIT 30
  ```

#### `get_stock_report`
- **Descricao:** Relatorio completo do estado do estoque (sumario executivo)
- **Parametros:** nenhum
- **Retorna um texto formatado com:**
  - Total de itens em estoque
  - Itens zerados/criticos
  - Itens vencendo em 7 dias
  - Total gasto no mes atual (via `stock_lots`)
  - Top 3 produtos mais consumidos no mes

---

## Fase 6: Entry Point Vercel

### Arquivo: `api/mcp.ts`

```typescript
import { createMcpHandler } from "mcp-handler";
import { authenticateRequest } from "../src/mcp/auth";
import { registerListTools } from "../src/mcp/tools/list";
import { registerStockTools } from "../src/mcp/tools/stock";
import { registerInsightTools } from "../src/mcp/tools/insights";

/**
 * Endpoint MCP do MeuEstoque.
 * Suporta Streamable HTTP transport (compativel com qualquer cliente MCP).
 * Autenticacao via JWT Supabase no header Authorization.
 */
const handler = createMcpHandler(
  (server) => {
    registerListTools(server);
    registerStockTools(server);
    registerInsightTools(server);
  },
  {
    name: "meuestoque-mcp",
    version: "1.0.0",
  },
  {
    // Middleware de autenticacao executado antes de cada tool call
    beforeRequest: async (req) => {
      const authHeader = req.headers.get("Authorization");
      return authenticateRequest(authHeader);
    },
  }
);

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
```

> **Nota arquitetural:** Cada tool vai receber o `AuthenticatedContext` (supabase, userId, groupId)
> via contexto injetado pelo `beforeRequest`. Verificar a API exata do `mcp-handler` para a
> forma correta de passar contexto entre o middleware e as tools.

---

## Estrutura Final de Arquivos

```
api/
  mcp.ts                  [NOVO] Entry point Vercel

src/
  mcp/
    auth.ts               [NOVO] Middleware JWT
    server.ts             [NOVO] (opcional) configuracoes centrais
    tools/
      list.ts             [NOVO] Tools de lista de compras
      stock.ts            [NOVO] Tools de estoque
      insights.ts         [NOVO] Analises e relatorios
```

---

## Verificacao Antes de Finalizar

Execute nesta ordem:

```bash
npm run lint         # Zero erros ESLint
npm run typecheck    # Zero erros TypeScript
npm test             # Todos os testes Vitest passando
npm run build        # Build de producao sem erros
```

### Teste manual do servidor MCP

Apos deploy ou em dev local, testar com curl:

```bash
# 1. Obter JWT do usuario (via Supabase Auth)
# 2. Testar listagem de tools
curl -X POST http://localhost:5173/api/mcp \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 3. Testar tool de lista
curl -X POST http://localhost:5173/api/mcp \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_shopping_list","arguments":{}}}'
```

### Configurar no Claude Desktop (verificacao final)

```json
{
  "mcpServers": {
    "meuestoque": {
      "url": "https://meuestoque.apenasgabs.dev/api/mcp",
      "headers": {
        "Authorization": "Bearer <JWT_DO_USUARIO>"
      }
    }
  }
}
```

---

## Atualizacoes Obrigatorias ao Finalizar

### 1. `.env.example`
Adicionar:
```bash
# MCP Server
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

### 2. `AI_KNOWLEDGE_BASE.md`
Adicionar log da feature no formato obrigatorio (ver secao 8 do AGENTS.md):
- Grafico Mermaid da arquitetura MCP
- Tabela de arquivos criados
- Logica de decisao (autenticacao, RLS, tools)
- Comportamento da feature
- Checklist de aceite

### 3. `docs/ai/04_RPC_CONTRACTS.md`
Documentar que `consume_stock_fifo` e `rpc_finalize_shopping_list` sao usadas pelo MCP server.

### 4. `docs/ai/01_ARCHITECTURE_AND_DATA.md`
Adicionar secao descrevendo o MCP server como nova camada de acesso ao backend.

---

## Pontos de Atencao Criticos

> [!CAUTION]
> **Nunca usar `SUPABASE_SERVICE_ROLE_KEY` no handler MCP publico.**
> Sempre usar o JWT do usuario para que o RLS proteja os dados.

> [!WARNING]
> **`api/tenda.ts` usa `runtime: "edge"` (Edge Runtime).**
> O `api/mcp.ts` deve usar Node.js Runtime (sem `export const config = { runtime: "edge" }`),
> pois o `mcp-handler` usa APIs do Node.js nao disponiveis no Edge Runtime.

> [!IMPORTANT]
> **A coluna `group_id` em `stock_items` e `items` nao precisa ser passada explicitamente.**
> O RLS do Supabase via `is_group_member(group_id)` filtra automaticamente quando o JWT e valido.
> O agente deve buscar o `group_id` via `group_members` apenas quando precisar de uma referencia
> explicita (ex: `ensureActiveListForGroup`).

> [!NOTE]
> **Verificar assinatura exata de `consume_stock_fifo` antes de implementar.**
> A RPC foi criada em `supabase/migrations/20260524_01_atomic_consume_stock_fifo.sql`.
> Ler o arquivo da migration para confirmar os nomes exatos dos parametros.

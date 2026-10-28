# 🤖 Base de Conhecimento e Log para IAs (AI Knowledge Base)

**ATENÇÃO, IA LENDO ESTE ARQUIVO:** Se você está trabalhando neste projeto, **você DEVE** consultar a documentação listada abaixo antes de alterar o código do sistema e **atualizar este arquivo** sempre que modificar regras ou infraestrutura importante!

Também há um arquivo de políticas de agentes no repositório raiz: `AGENTS.md`. Leia-o antes de começar a modificar código — ele contém passos obrigatórios que agentes automatizados devem seguir.

## 📖 Como a Documentação está Organizada

Para facilitar a leitura e não estourar seu contexto, quebramos as especificações da aplicação em arquivos menores na pasta `docs/ai/`:

1. 👉 **`.github/copilot-instructions.md`** — Regras gerais, padrões de código, linting, tipos e estilo.
2. 👉 **`docs/ai/01_ARCHITECTURE_AND_DATA.md`** — Arquitetura, Supabase e fluxo RPC.
3. 👉 **`docs/ai/02_UX_AND_BUSINESS_RULES.md`** — UX, Chips, Parser, Unidade Composta, Bulk Mode.
4. 👉 **`docs/ai/03_COMPONENTS.md`** — Componentes UI (Tailwind/daisyUI).
5. 👉 **`docs/ai/04_RPC_CONTRACTS.md`** — Contratos das funções Postgres.
6. 👉 **`docs/ai/05_DATABASE_MAP.md`** — Índice para o ER diagrama em `docs/database_map.md`.
7. 👉 **`docs/ai/06_E2E_TESTING.md`** — Arquitetura E2E (State Injection + Playwright).
8. 👉 **`docs/ai/feature-*.md`** — Documentação dedicada por feature (ex: `feature-bulk-expiration.md`).

Documentação fora de `docs/ai/`:

- **`README.md`** — overview do projeto e setup rápido.
- **`docs/SETUP.md`** — setup completo com Supabase + migrations.
- **`docs/FEATURES.md`** — visão de produto/funcionalidades.
- **`docs/GLOSSARY.md`** — termos canônicos do domínio.
- **`docs/STACK_DIAGRAM.md`** — visão runtime React → Supabase.
- **`docs/adr/`** — Architectural Decision Records.
- **`docs/internal/`** — espaço para conteúdo não-técnico (interno).

---

## 📜 Regras de Documentação (Padrão Exigido)

**TODA VEZ** que você finalizar uma tarefa que impacta a arquitetura, negócio ou cria novos fluxos, você **DEVE** logar as mudanças aqui usando o seguinte formato estrito:

1. **Gráfico Mermaid**: Para mostrar o fluxo de dados ou a dependência de componentes.
2. **Tabela de Arquivos**: Explicando os arquivos modificados/criados.
3. **Lógica de Decisão**: Bloco de código com a regra ou fluxo em texto puro.
4. **Comportamento**: Resumo em bullet points do que o sistema faz na prática.
5. **Checklist de Aceite**: O que foi garantido que funciona.

---

## 📜 Log Recente de Modificações por IAs

### 📱💻 (28/10/2026) Feature: Grid Responsivo e Max-Width para Tablet e Desktop (Issue #46)

#### Arquitetura
```mermaid
graph TD
    A[ListPageNew / StockPageNew] --> B[StockView / ShoppingListView]
    B -->|max-w-6xl mx-auto| C[CategorySection]
    C -->|grid-cols-1 md:grid-cols-2 xl:grid-cols-3| D[ProductCard]
    B -->|max-w-4xl mx-auto| E[ShoppingListItem]
    B -->|fixed dock max-w-4xl| F[Finalize Shopping Dock]
```

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `src/features/inventory/components/categorySection/CategorySection.tsx` | Aplicação de grid responsivo `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3` com `data-testid="category-products-grid"` |
| `src/features/inventory/components/categorySection/CategorySection.test.tsx` | Testes unitários para renderização dos produtos em grid e toggle de categorias |
| `src/features/inventory/components/stockView/StockView.tsx` | Contêiner raiz e rolável com `max-w-6xl mx-auto w-full`, padding responsivo `p-2 sm:p-4` e `pb-40` para evitar conflito com FABs |
| `src/features/inventory/components/shoppingListView/ShoppingListView.tsx` | Contêiner raiz, lista rolável e dock de finalização delimitados em `max-w-4xl mx-auto w-full` com padding dinâmico |
| `src/pages/ListPageNew.tsx` | Alinhamento do banner de NFC-e com a largura da lista (`max-w-4xl px-4 pt-4`) |

#### Lógica de Decisão
```text
REGRA 1: Telas mobile (< 768px) mantêm layout em coluna única (grid-cols-1), garantindo conforto e densidade no uso com uma mão.
REGRA 2: Telas tablet (>= 768px) utilizam 2 colunas no estoque (md:grid-cols-2) e centralização de lista em max-w-4xl mx-auto.
REGRA 3: Telas desktop (>= 1280px) expandem o estoque para 3 colunas (xl:grid-cols-3) contidas em max-w-6xl mx-auto, evitando estiramento excessivo dos cards.
REGRA 4: A barra inferior flutuante de finalização de compra acompanha a largura máxima do conteúdo central (max-w-4xl mx-auto) sobre o dock translúcido de largura total.
```

#### Comportamento
- Em telas mobile, os cards de estoque e da lista de compras continuam em lista vertical com touch targets adequados.
- Em tablets e iPads, o estoque se distribui em 2 colunas organizadas por categoria, e a lista de compras é centralizada para leitura ergonômica.
- Em monitores desktop ultrawide ou 1080p+, o estoque se expande em até 3 colunas dentro de 1152px (max-w-6xl), evitando linhas esticadas de ponta a ponta.
- A barra de finalizar compra mantém o fundo translúcido e borda superior por toda a largura da tela, com o botão principal alinhado ao centro junto aos cards da lista.

#### Checklist de Aceite
- [x] Lint passando (0 erros)
- [x] Typecheck passando (0 erros)
- [x] Testes unitários passando (32 suites, 264 testes verdes)
- [x] Build de produção concluído com sucesso
- [x] Conflitos de merge com a branch `main` (após PR #48 e #47) 100% resolvidos

### 🧾 (26/10/2026) Feature: Importação de NFC-e via QR Code para Lista e Finalização (Issue #42)

#### Arquitetura
```mermaid
graph TD
    A[Botão Escanear Nota] --> B[NfceScannerModal - QR Code / Input]
    B --> C[api/nfce - Vercel Edge Proxy SEFAZ]
    C --> D[nfceParser - Normalização de Itens e Total]
    D --> E[receiptMatcher - Match Inteligente com a Lista]
    E --> F[NfceReviewDrawer - Painel de Conferência]
    F -->|Aplicar na Lista| G[Lista Ativa Preenchida + store_price_history]
    G -->|Finalizar Compra| H[RPC Finalize + Histórico + Estoque Atualizado]
```

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `api/nfce.ts` | Edge Function para consulta segura e parsing de NFC-e (SEFAZ-SP) com proteção SSRF e codificação de pipes |
| `src/domain/nfceParser.ts` | Parser puro de HTML da NFC-e (extração de emitente, data, total e itens) |
| `src/domain/nfceParser.test.ts` | Testes unitários do parser com HTML sintético e conversão segura de data local |
| `src/domain/receiptMatcher.ts` | Motor de correspondência 1-para-1 com expansão de abreviações e preservação de validades |
| `src/domain/receiptMatcher.test.ts` | Testes unitários do motor de match |
| `src/services/nfceService.ts` | Cliente frontend para consulta da API `/api/nfce` |
| `src/services/nfceService.test.ts` | Testes unitários do serviço HTTP |
| `src/services/priceHistoryService.ts` | Adicionado `recordNfcePriceHistory` para persistir os preços unitários da nota em `store_price_history` com tags JSDoc completas |
| `src/lib/scannerDetector.ts` | Suporte a leitura de QR Code além de código de barras 1D |
| `src/components/Scanner/NfceScannerModal.tsx` | Modal com mira de câmera para leitura de QR Code ou input de URL/chave com atributos `aria-label` e fallback para conexões não seguras |
| `src/components/Scanner/__tests__/NfceScannerModal.test.tsx` | Testes unitários do modal de scanner e entrada manual acessível |
| `src/components/NfceReviewDrawer/NfceReviewDrawer.tsx` | Gaveta/Bottom Sheet de conferência de itens casados, novos e ausentes com `label` acessível, `focus-within`, `data-testid` e data local sem desvio UTC-3 |
| `src/components/NfceReviewDrawer/__tests__/NfceReviewDrawer.test.tsx` | Testes unitários da gaveta de conferência de NFC-e |
| `src/api/__tests__/nfce.test.ts` | Testes unitários da Edge Function de NFC-e (SSRF, timeout, allowlist de hosts e validação de parâmetros) |
| `src/features/inventory/components/shoppingListView/ShoppingListView.tsx` | Botão "Escanear Nota" na barra de ações |
| `src/pages/ListPageNew.tsx` | Fluxo em 2 etapas: aplica a nota na lista ativa (com banner de revisão) e finaliza com a data de emissão da nota + refresh do `useStockStore` |
| `src/lib/webData.ts` | `applyReceiptMatchToListItem`, suporte a data de compra em `finishShoppingList` e ordenação de `loadShoppingHistory` por `finalizada_em` |

#### Lógica de Decisão
```text
REGRA 1: Validade é sagrada. A nota fiscal não traz datas de validade, portanto o motor de match preserva rigorosamente a validade pré-cadastrada na lista de compras (data ou não se aplica).
REGRA 2: Fluxo em 2 etapas (Confirmar na Gaveta -> Revisar na Lista -> Finalizar Compra). Ao clicar em "Aplicar na Lista", os itens casados têm preços/quantidades atualizados e são marcados como comprados, e os itens novos da nota são adicionados à lista ativa para que o usuário possa revisar nomes e validades antes de finalizar.
REGRA 3: Os preços unitários da nota fiscal são persistidos imediatamente em `store_price_history`, e ao finalizar a compra via RPC, a lista fechada fica no topo do histórico (`loadShoppingHistory` ordenado por `finalizada_em DESC`) e os lotes em `stock_lots` alimentam o histórico de preços do estoque.
REGRA 4: A data efetiva da compra no estoque e no histórico é sincronizada com a data de emissão do cupom fiscal.
```

#### Comportamento
- O usuário clica em "Escanear Nota" na lista de compras.
- Aponta a câmera para o QR Code impresso no cupom fiscal da SEFAZ (ou cola a URL / chave de 44 dígitos).
- O backend consulta a SEFAZ-SP, normaliza os dados e cruza com a lista de compras atual.
- Abre o painel lateral de conferência exibindo itens casados (com novo preço e quantidade, mantendo validades) e novos itens do carrinho.
- Ao clicar em "Aplicar na Lista", a gaveta fecha, os itens aparecem preenchidos e marcados na lista ativa com um banner da nota aplicada, e os preços vão para `store_price_history`.
- O usuário revisa a lista (podendo renomear ou ajustar validades) e clica em "Finalizar compra" para gravar no histórico de compras e no estoque.

#### Checklist de Aceite
- [x] Lint passando (0 erros)
- [x] Typecheck passando (0 erros)
- [x] Testes passando (29 suites, 253 testes verdes)
- [x] Build de produção sem erros
- [x] Apontamentos de code review (SSRF, timeout, acessibilidade, fuso horário UTC-3 e JSDoc) 100% resolvidos e testados

### 🌐 (25/10/2026) Feature: Suporte a OAuth 2.1 para Claude Web e Conectores Remotos MCP (Issue #40)

#### Arquitetura
```mermaid
sequenceDiagram
    participant CW as Claude.ai Web
    participant V as Vercel Edge (api/.well-known, api/oauth/token, api/mcp)
    participant U as Navegador do Usuário (/oauth/authorize)
    participant PG as Postgres (mcp_oauth_codes, mcp_api_keys, RPCs)

    CW->>V: GET /api/mcp (sem auth)
    V-->>CW: 401 Unauthorized + WWW-Authenticate (resource_metadata)
    CW->>V: GET /.well-known/oauth-protected-resource (RFC 9728)
    V-->>CW: Metadata com authorization_servers
    CW->>V: GET /.well-known/oauth-authorization-server (RFC 8414)
    V-->>CW: Metadata com authorization_endpoint e token_endpoint
    CW->>U: Redireciona para /oauth/authorize?response_type=code&code_challenge=...&S256
    U->>PG: rpc create_mcp_oauth_code (autenticado via Supabase Auth)
    PG-->>U: code (mest_code_...)
    U-->>CW: Redireciona com code e state
    CW->>V: POST /api/oauth/token (grant_type=authorization_code, code, code_verifier)
    V->>PG: rpc exchange_mcp_oauth_code (valida PKCE S256 e single-use)
    PG-->>V: Emite token persistente mest_oa_... registrado em mcp_api_keys (365 dias)
    V-->>CW: { access_token: "mest_oa_...", token_type: "Bearer", expires_in: 31536000 }
    CW->>V: POST /api/mcp (Bearer mest_oa_...)
    V->>PG: rpc exchange_mcp_api_key (troca mest_oa_ por JWT curto de 5 min com secret do Vault)
    PG-->>V: Executa tools MCP sob RLS do usuário
```

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `supabase/migrations/20261025_01_mcp_oauth.sql` | **Criado**: Migration criando tabela `mcp_oauth_codes`, RPCs `create_mcp_oauth_code` e `exchange_mcp_oauth_code` com validação matemática PKCE SHA-256 e emissão de token `mest_oa_` em `mcp_api_keys`, além de atualizar `exchange_mcp_api_key` para aceitar `mest_oa_`. |
| `api/well-known/oauth-protected-resource.ts` | **Criado**: Endpoint Edge servindo metadata RFC 9728 com descoberta dinâmica do origin e headers CORS. |
| `api/well-known/oauth-authorization-server.ts` | **Criado**: Endpoint Edge servindo metadata RFC 8414 com declaração de rotas OAuth 2.1, PKCE S256 e endpoints de token. |
| `api/oauth/token.ts` | **Criado**: Endpoint Edge para troca segura de authorization code e `code_verifier` por `access_token` persistente. |
| `api/mcp.ts` | Atualizado para responder `401 Unauthorized` com header `WWW-Authenticate: Bearer resource_metadata="..."` para auto-descoberta. |
| `vercel.json` | Atualizado com rewrites para `/.well-known/oauth-protected-resource` e `/.well-known/oauth-authorization-server`. |
| `src/lib/mcpOAuth.ts` | **Criado**: Serviço client-side para validação de parâmetros OAuth 2.1 (PKCE S256, redirect_uri, response_type), montagem de URL de callback e invocação da RPC. |
| `src/lib/mcpOAuth.test.ts` | **Criado**: Testes unitários para regras de validação de parâmetros e chamada RPC. |
| `src/pages/OAuthAuthorizePage.tsx` | **Criado**: Tela de consentimento amigável com daisyUI para aprovação de escopos (read/write) e conexão com Claude.ai. |
| `src/pages/OAuthAuthorizePage.test.tsx` | **Criado**: Testes unitários cobrindo fluxos de loading, não-autenticado, parâmetros inválidos, cancelamento e autorização. |
| `src/ComprasWebShell.tsx` | Registrada nova rota `/oauth/authorize`. |
| `src/mcp/auth.ts` | Atualizado `MCP_KEY_PATTERN` para aceitar tokens com prefixo `mest_oa_`. |
| `src/mcp/__tests__/mcp.test.ts` | Adicionado teste garantindo validação e troca de token `mest_oa_`. |
| `package.json` | Script `"test"` atualizado para `"NODE_ENV=test vitest run"`. |

#### Lógica de Decisão
```text
REGRA 1: Clientes remotos e Claude.ai Web descobrem os endpoints via RFC 9728 e RFC 8414 através do header WWW-Authenticate em /api/mcp.
REGRA 2: A autorização exige obrigatoriamente PKCE S256 (code_challenge entre 40 e 128 chars); conexões sem PKCE ou com método plain são rejeitadas.
REGRA 3: O authorization code expira em 10 minutos, é armazenado exclusivamente como hash sha256 e possui uso estritamente único.
REGRA 4: A troca do código por token cria um token persistente mest_oa_ registrado na tabela mcp_api_keys (visível e revogável a qualquer momento pelo usuário no Perfil).
REGRA 5: As requisições de tools MCP com mest_oa_ são trocadas internamente no Postgres por JWTs de 5 minutos assinados pelo Vault, preservando RLS integral e multi-tenant sem qualquer custo adicional.
```

#### Comportamento
- Usuários podem conectar o MeuEstoque diretamente pela interface web do Claude.ai (Conectores Remotos).
- O Claude.ai detecta automaticamente o servidor de autenticação via RFC 9728 / RFC 8414.
- O usuário é levado para a tela de consentimento `/oauth/authorize`, onde pode ver o nome do cliente, o usuário logado e os escopos solicitados.
- Ao clicar em "Autorizar acesso", a RPC valida e gera o código, redirecionando o navegador para o Claude com o código e state.
- O Claude troca o código por um access_token persistente (`mest_oa_...`), que aparece na tela de Perfil do usuário sob "Tokens de Integração (MCP)" com a tag "Claude.ai (OAuth)" e pode ser revogado a qualquer momento.

#### Checklist de Aceite
- [x] Lint passando (0 erros ESLint)
- [x] Testes passando (22 arquivos, 201 testes unitários verdes)
- [x] Build sem erros (`tsc -b && vite build`)

### 🔑 (13/10/2026) Feature: Autenticação Persistente MCP via Personal Access Tokens (Issue #36)

#### Arquitetura
```mermaid
sequenceDiagram
    participant C as Cliente MCP (Claude / Cursor)
    participant V as api/mcp.ts (Vercel Edge Handler)
    participant A as auth.ts (Middleware Auth)
    participant PG as Postgres (Supabase RPC)
    participant T as Tools MCP (List / Stock / Insights)

    C->>V: POST /api/mcp (Bearer mest_pat_xxx)
    V->>A: authenticateRequest(authHeader)
    A->>PG: rpc exchange_mcp_api_key(p_key)
    PG->>PG: sha256 -> verifica ativa -> gera JWT curto (5m, HS256)
    PG-->>A: { access_token, user_id, scopes }
    A->>V: Injeta AuthenticatedContext (RLS via JWT curto)
    V->>T: Executa Tool (valida scopes read/write via extractContext)
    T-->>C: Retorna resposta da tool
```

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `supabase/migrations/20261012_01_mcp_api_keys.sql` | **Criado**: Migration criando tabela `mcp_api_keys`, RLS, índices e RPCs seguras `create_mcp_api_key`, `revoke_mcp_api_key`, `revoke_all_mcp_api_keys` e `exchange_mcp_api_key`. |
| `src/lib/mcpKeys.ts` | **Criado**: Serviço client-side para listar, criar e revogar chaves MCP, utilitários de status e construtor de config JSON. |
| `src/lib/mcpKeys.test.ts` | **Criado**: Testes unitários para regras de status, serialização de config e tratamento de erros do serviço de chaves. |
| `src/components/McpKeysSection/McpKeysSection.tsx` | **Criado**: Componente de UI no Perfil para criação de chaves (nome, validade, escopo somente leitura), modal com segredo exibido uma única vez, ações de cópia e revogação. |
| `src/components/McpKeysSection/McpKeysSection.test.tsx` | **Criado**: Testes unitários de renderização, criação, exibição modal e revogação do componente UI. |
| `src/pages/ProfilePage.tsx` | Substituída a geração simples de token temporário pelo componente `McpKeysSection`. |
| `src/mcp/auth.ts` | Middleware refatorado para suportar chaves persistentes `mest_pat_...` (com troca por JWT de 5m no Postgres) mantendo compatibilidade legada com sessões. |
| `src/mcp/context.ts` | **Criado**: Utilitários `extractContext` e `extractWriteContext` para isolamento seguro do contexto MCP e validação de escopos `read` e `write`. |
| `src/mcp/tools/list.ts` | Atualizado para usar `extractWriteContext` em operações de mutação (add, update, delete, finalize). |
| `src/mcp/tools/stock.ts` | Atualizado para usar `extractWriteContext` na tool `consume_stock_fifo`. |
| `src/mcp/tools/insights.ts` | Atualizado para usar `extractContext` compartilhado. |
| `src/mcp/__tests__/mcp.test.ts` | Atualizado com testes completos cobrindo rejeição de chaves inválidas/malformadas, troca por JWT curto e controle de escopos. |
| `api/mcp.ts` | Refatorado para tratamento centralizado de `McpAuthError` com retorno 401 limpo e tipagem estrita de contexto. |
| `docs/features/feature-mcp-persistent-tokens.md` | **Criado**: Documentação detalhada da feature, garantias de segurança, diagramas e passos de setup. |
| `docs/ai/04_RPC_CONTRACTS.md` | Documentados contratos das novas RPCs de autenticação MCP. |
| `docs/ai/05_DATABASE_MAP.md` | Atualizado mapa do banco com a tabela `mcp_api_keys`. |

#### Lógica de Decisão
```text
REGRA 1: Clientes MCP utilizam chaves com prefixo mest_pat_ e 43 caracteres base64url (256 bits de entropia).
REGRA 2: A chave secreta completa nunca é salva em texto puro no banco de dados; apenas seu hash sha256 é persistido.
REGRA 3: O servidor MCP troca a chave por um JWT assinado internamente no Postgres (validade de 5 minutos) usando o segredo mcp_jwt_secret do Vault, sem necessidade de chaves de serviço expostas no Vercel Edge.
REGRA 4: Todas as ferramentas MCP executam sob o contexto RLS do usuário associado à chave, aplicando isolamento multi-tenant estrito.
REGRA 5: Chaves com escopo somente leitura (read) têm acesso negado imediatamente ao tentar acionar ferramentas de modificação (extractWriteContext).
```

#### Comportamento
- Usuários podem gerar múltiplos Personal Access Tokens (PATs) no painel de Perfil, especificando nome, prazo de validade (30, 90 ou 365 dias) e permissão de leitura/escrita.
- A chave é exibida uma única vez em modal dedicado, com botões para cópia da chave, da configuração JSON para clientes MCP e de prompt pré-formatado para agentes de IA.
- A lista de chaves exibe o prefixo identificador, data de criação, último uso e badges dinâmicos de status (Ativa, Expira em breve, Expirada, Revogada).
- O usuário pode revogar chaves individualmente ou em lote ("Revogar todas").
- Requisições MCP com chave revogada ou expirada são rejeitadas imediatamente com HTTP 401.

#### Checklist de Aceite
- [x] Migration criada com tabela, índices, RLS e RPCs seguras com `SECURITY DEFINER`.
- [x] Zero erros de ESLint (`npm run lint`).
- [x] Zero erros de TypeScript (`npm run typecheck`).
- [x] 100% de aprovação nos testes unitários (`npm test` cobrindo mcp, mcpKeys e McpKeysSection).
- [x] Build de produção concluído com sucesso (`npm run build`).

### 📝 (12/10/2026) Feature: Edição do Nome de Itens na Lista de Compras

#### Arquitetura
```mermaid
graph TD
    A["ShoppingListItem (UI Inline Edit)"] -->|"onUpdateName(itemId, newName)"| B["ShoppingListView"]
    B -->|"onUpdateItemName"| C["ListPageNew (handleUpdateItemName)"]
    C -->|"Update Otimista (setShoppingItems)"| D["Estado Local"]
    C -->|"updateListItemName"| E["webData.ts"]
    E -->|"UPDATE items (nome, marca, produto_base)"| F["Supabase DB"]
```

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `src/features/inventory/components/shoppingListItem/ShoppingListItem.tsx` | Adicionado modo de edição inline para o nome do item com botão de lápis, input de texto com autoFocus, atalhos de teclado (Enter salva, Esc cancela), botões de confirmação/cancelamento e callback `onUpdateName`. |
| `src/features/inventory/components/shoppingListItem/ShoppingListItem.test.tsx` | **Criado**: 8 testes unitários cobrindo abertura da edição (por botão ou clique no nome), persistência (botão e Enter), cancelamento (botão e Esc), prevenção de updates sem alteração. |
| `src/features/inventory/components/shoppingListView/ShoppingListView.tsx` | Adicionada prop `onUpdateItemName` na interface e repassada ao `ShoppingListItem`. |
| `src/pages/ListPageNew.tsx` | Implementado `handleUpdateItemName` com update otimista no estado da lista e chamada a `updateListItemName` persistindo no Supabase com toast de feedback. |

#### Lógica de Decisão
```text
REGRA 1: Ao clicar no nome ou no botão de lápis do item (fora do modo bulk), ativa-se o input de edição com o valor atual preenchido.
REGRA 2: Salvar aplica trim() no texto; se o nome for válido e diferente do original, dispara updateListItemName(itemId, novoNome).
REGRA 3: O updateListItemName re-extrai automaticamente marca e produto_base para manter a integridade do catálogo e cotações Tenda.
REGRA 4: Em caso de falha de rede, o estado local da lista é revertido para o valor original via refreshItems().
```

#### Comportamento
- O usuário agora pode editar o nome de qualquer item já existente na lista de compras diretamente no card.
- A edição pode ser acionada clicando no ícone de lápis ou diretamente sobre o nome do item.
- Salva ao clicar no botão "✓", ao teclar Enter ou ao perder o foco (blur).
- Cancela sem alterar ao clicar em "✕" ou ao teclar Escape.
- Exibe notificação de confirmação (Toast) informando o novo nome do item.

#### Checklist de Aceite
- [x] Lint passando (`npm run lint` com zero erros)
- [x] Typecheck passando (`npm run typecheck` com zero erros)
- [x] Testes unitários passando (`ShoppingListItem.test.tsx` 8/8)
- [x] Build de produção sem erros (`npm run build`)

### 📝 (14/09/2026) Correção: Build da Vercel (Dependências)

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `package.json` | Adicionado `@modelcontextprotocol/server` como dependência para satisfazer a exigência (peer dependency) do `mcp-handler`. |
| `yarn.lock`, `pnpm-lock.yaml` | Deletados para forçar a Vercel a usar o `npm` (referência do `package-lock.json`). |

#### Lógica de Decisão
```text
REGRA: Projetos Vercel se confundem quando há múltiplos lockfiles (yarn.lock + package-lock.json). A Vercel escolhe Yarn por padrão, o que gera inconsistências no build de workspaces ou dependências faltantes. O correto é manter apenas package-lock.json.
```
### 📝 (14/09/2026) Correção: Cálculo de Total no Tenda Atacado

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `src/pages/ListPageNew.tsx` | Correção na aplicação de preço e troca de marca via Tenda |

#### Lógica de Decisão
```text
REGRA: Cotações do Tenda retornam preço UNITÁRIO. Ao aplicar o preço para itens com quantidade > 1, o sistema deve multiplicar pela quantidade do item na lista.
```

#### Comportamento
- O sistema antes atualizava o `preco_total` com o valor unitário da cotação
- Agora, a função `handleApplyTendaPrice` aciona `fireUpdateItemUnitPrice` (em vez de `fireUpdateItemPrice`), que realiza a multiplicação da quantidade inserida pelo valor unitário recebido.

#### Checklist de Aceite
- [x] Lint passando
- [x] Testes passando
- [x] Build sem erros
### 🤖 (14/09/2026) Feature: Servidor MCP Serverless (Integração de IA)

#### Arquitetura
```mermaid
graph TD
    A["Agente IA"] -->|"POST /api/mcp (JWT Bearer)"| B["api/mcp.ts (Vercel)"]
    B -->|"auth.ts (Validação)"| C["Supabase Auth"]
    C -->|"Contexto RLS"| D["Tools MCP"]
    D -->|"RPC e queries"| E["Supabase DB"]
```

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `MCP_PLAN.md` | **Criado**: Plano de ação detalhado para a implementação do MCP. |
| `api/mcp.ts` | **Criado**: Entry point Serverless para o MCP, expondo o Streamable HTTP transport via `mcp-handler`. |
| `src/mcp/auth.ts` | **Criado**: Middleware de autenticação JWT injetando cliente Supabase com RLS ativado. |
| `src/mcp/tools/list.ts` | **Criado**: Tools para gestão completa da lista de compras (adicionar, listar, marcar, finalizar). |
| `src/mcp/tools/stock.ts` | **Criado**: Tools para consumo, listagem e verificação de vencimento no estoque. |
| `src/mcp/tools/insights.ts` | **Criado**: Tools para relatórios de consumo, gastos e tendências de preço (Tenda). |
| `docs/ai/01_ARCHITECTURE_AND_DATA.md` | **Modificado**: Documentada nova arquitetura de acesso MCP. |
| `.env.example` e `.env` | **Modificado**: Adicionadas variáveis do Supabase exclusivas para o servidor backend. |

#### Lógica de Decisão
```text
REGRA 1: O servidor MCP nunca usa a chave service_role pública para acessar o Supabase; o cliente deve enviar seu próprio JWT no cabeçalho Authorization para manter a integridade do RLS.
REGRA 2: Utiliza `mcp-handler` e Vercel Serverless Functions para expor a API usando o padrão HTTP Transport Serverless.
REGRA 3: O contexto injeta o `group_id` ativo, dispensando parâmetros repetitivos nas chamadas MCP e garantindo queries seguras.
```

#### Comportamento
- O sistema expõe na rota `/api/mcp` um endpoint aderente à especificação oficial do Model Context Protocol (MCP).
- Permite que o Claude Desktop, Cursor, Antigravity ou outros agentes controlem o app interagindo diretamente via ferramentas registradas e validadas por `zod`.

#### Checklist de Aceite
- [x] Variáveis de ambiente configuradas no `.env`.
- [x] Arquivos base e tools programadas em TypeScript.
- [x] O middleware Auth garante a proteção dos dados via RLS.
- [x] Dependência incluída no arquivo (Nota: NPM install de mcp-handler encontrou 403 Forbidden pelo bloqueio de rede no ambiente simulado, mas as instruções e scripts locais estão prontas para o desenvolvedor usar assim que rodar npm install).


### 🏷️ (13/09/2026) Bugfix: Preparação Dicionário de Produtos (Fase 3)
### 📊 (13/09/2026) Feature: Dicionário Global de Marcas e Histórico de Preços (Fase 3)

#### Arquitetura
```mermaid
graph TD
    A["TendaPriceDrawer (Cotação)"] -->|"Cotações obtidas"| B["priceHistoryService.recordStorePriceHistory"]
    B -->|"Upsert idempotente diário"| C["store_price_history (Supabase DB)"]
    D["SessionBootstrap"] -->|"syncBrandDictionaryFromSupabase"| E["global_brands (Supabase DB)"]
    E -->|"Carrega marcas & aliases"| F["brandDictionaryService (Cache Local)"]
    A -->|"getPriceHistoryForBaseProduct"| C
    A -->|"calculatePriceTrend"| G["Badge de Tendência (↓ % / ↑ % / = Estável)"]
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `supabase/migrations/20260913_01_phase_3_global_dictionary_and_price_history.sql` | **Criado**: Migration criando `global_brands` (com aliases), `global_base_products` e `store_price_history` com RLS e índices. |
| `src/services/priceHistoryService.ts` | **Criado**: Serviço para persistência de histórico de cotações por filial, consulta temporal e cálculo de tendência de preço. |
| `src/services/priceHistoryService.test.ts` | **Criado**: Testes unitários para cálculo de tendências, desconsideração de data atual e consulta de histórico. |
| `src/services/brandDictionaryService.ts` | Atualizado para carregar de `global_brands` com aliases e gravar descobertas em ambas as tabelas para retrocompatibilidade. |
| `src/services/brandDictionaryService.test.ts` | Adicionados testes de sincronização de aliases e resolução de nomes canônicos. |
| `src/components/TendaPriceDrawer/TendaPriceDrawer.tsx` | Integrada gravação assíncrona de histórico de cotações e badge visual de tendência de preço nos cards de ofertas. |
| `src/components/SessionBootstrap.tsx` | Refatorado para arrow function e controle com `syncedUserIdRef` para evitar syncs duplicados em refresh de tokens. |
| `src/components/__tests__/SessionBootstrap.test.tsx` | **Criado**: Testes unitários para ciclo de vida de autenticação e disparo isolado do sync de marcas. |
| `src/services/tendaService.test.ts` | Adicionados 16 testes de tabela cobrindo exclusões e compatibilidade de `DERIVATIVE_WORDS` e relevância semântica. |

#### Lógica de Decisão
```text
REGRA 1: Cotações realizadas na gaveta lateral são gravadas assincronamente em `store_price_history` com constraint UNIQUE por (loja, filial_id, produto_nome, data_cotacao).
REGRA 2: O cálculo de tendência compara o preço atual com a cotação imediatamente anterior do mesmo produto base/marca (ignorando cotações da data corrente).
REGRA 3: O dicionário de marcas sincroniza a partir de `global_brands` suportando arrays de aliases para mapeamento flexível de marcas variantes.
REGRA 4: O SessionBootstrap dispara a sincronização de marcas apenas na primeira autenticação ou na troca de usuário autenticado (`session.user.id !== syncedUserIdRef.current`), evitando chamadas desnecessárias em refreshes de token.
```

#### Comportamento
- Toda cotação realizada no Tenda alimenta o histórico de preços da filial no Supabase sem travar a navegação do usuário.
- Produtos cotados que já possuem histórico prévio exibem indicadores visuais de variação (ex: `↓ 5.2%` ou `↑ 10%`) comparando com o último preço visto.
- O sistema de reconhecimento de marcas agora suporta múltiplos aliases mapeados para a marca canônica.
- O filtro semântico possui regras testadas e documentadas contra falsos positivos em derivados.

#### Checklist de Aceite
- [x] Migration criada com RLS e backfill automático de dados existentes.
- [x] Zero erros de ESLint (`npm run lint`).
- [x] Zero erros de TypeScript (`npm run typecheck`).
- [x] Testes unitários cobrindo SessionBootstrap, histórico de preços, aliases e palavras derivadas passando com 100% de sucesso (69/69).
- [x] Build de produção concluído com sucesso (`npm run build`).

#### Arquitetura
```mermaid
graph TD
    A["SessionBootstrap"] -->|"onAuthStateChange (SIGNED_IN)"| B["syncBrandDictionaryFromSupabase"]
    C["isProductSemanticallyRelevant"] -->|"Filtro expandido (Bolo, Torta, etc.)"| D["Cotação mais precisa"]
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `src/components/SessionBootstrap.tsx` | Movida a chamada `syncBrandDictionaryFromSupabase` para dentro do listener de autenticação, prevenindo falha silenciosa de RLS. |
| `src/services/tendaService.ts` | Adicionadas palavras derivativas (`bolo`, `torta`, `palha`, `pure`, `flocos`, `pudim`, `iogurte`, `vitamina`, `conserva`) ao `DERIVATIVE_WORDS` para evitar falsos positivos na comparação semântica. |

#### Lógica de Decisão
```text
REGRA 1: Sincronização do dicionário com o Supabase só deve ocorrer *após* a resolução do estado de autenticação, para respeitar políticas de RLS `TO authenticated`.
REGRA 2: Produtos derivativos compostos (ex: "Bolo de Cenoura") não devem ser considerados como alternativas válidas para ingredientes base (ex: "Cenoura").
```

#### Comportamento
- O dicionário de marcas agora carrega de forma confiável após o login, em vez de falhar silenciosamente no mount inicial da aplicação.
- A cotação de ingredientes puros (como "Cenoura 200g") não retorna mais produtos processados não relacionados (como "Bolo Cenoura Bauducco").

#### Checklist de Aceite
- [x] Sincronização rodando no momento correto da sessão.
- [x] Testes passando e build concluído.
- [x] O terreno agora está totalmente livre e validado para a continuação da Fase 3.


### 🏷️ (13/09/2026) Feature: Dicionário Dinâmico de Marcas & Comparação de Preços Tenda (Fase 2)

#### Arquitetura
```mermaid
graph TD
    A["SessionBootstrap"] -->|"syncBrandDictionaryFromSupabase (Startup)"| B["brand_dictionary (Supabase DB)"]
    B -->|"Carrega marcas ativas"| C["brandDictionaryService (Cache em Memória)"]
    D["Tenda Search API"] -->|"recordDiscoveredBrands (Batch Upsert)"| B
    E["ListPageNew / Parser / Barcode"] -->|"extractProductParts"| C
    E -->|"Persiste marca & produto_base"| F["items & product_catalog (DB)"]
    G["TendaPriceDrawer"] -->|"quoteShoppingItemOnTenda"| H["tendaService"]
    H -->|"Busca por produto_base + Compara marca solicitada vs mais barata"| I["Oferta Mesma Marca + Alternativa Mais Barata"]
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `src/services/brandDictionaryService.ts` | Adicionado carregamento de inicialização via Supabase (`syncBrandDictionaryFromSupabase`), registro em lote com `upsert ignoreDuplicates` (`recordDiscoveredBrands`) e suporte a regex unicode. |
| `src/services/tendaService.ts` | Chamada em lote para registrar marcas descobertas e busca por produto_base mantendo alternativas de marcas. |
| `src/lib/webData.ts` | Persistência e leitura das colunas `marca` e `produto_base` na tabela `items`. |
| `src/lib/barcodeService.ts` | Persistência de `marca` e `produto_base` no `product_catalog`. |
| `src/components/SessionBootstrap.tsx` | Background sync do dicionário no login. |
| `src/components/TendaPriceDrawer/TendaPriceDrawer.tsx` | Banner verde de economia com botão "Trocar Marca" e link direto para o produto. |

#### Lógica de Decisão
```text
REGRA 1: Ao inicializar a sessão, carregar todas as marcas ativas de `brand_dictionary` em cache local (Set/Map).
REGRA 2: Ao extrair partes do produto (`extractProductParts`), isolar a marca e definir `produto_base`.
REGRA 3: Ao buscar no Tenda, cotar pelo `produto_base` para trazer alternativas mais baratas, destacando a marca original quando solicitada.
REGRA 4: Marcas novas descobertas na API são salvas em lote via `.upsert({ onConflict: 'nome_normalizado', ignoreDuplicates: true })` sem poluição 409 na rede.
```

#### Comportamento
- Usuário vê oferta da marca solicitada ou genérica.
- Se houver marca alternativa compatível mais barata com economia relevante, exibe banner verde com cálculo de economia, foto da nova marca e botão "Trocar Marca".
- Clicar em "Usar Preço" na oferta original atualiza apenas o valor do item.
- Clicar em "Trocar Marca" (ou "Usar" em outra opção da lista) promove o produto no drawer (atualizando imagem, nome e link) e **atualiza tanto o nome quanto o preço do item na lista de compras**, sincronizando `marca` e `produto_base` no banco de dados.
- Requisições na aba Network totalmente limpas (sem erros 409 de conflito).

#### Checklist de Aceite
- [x] Testes unitários passando (`npx vitest run`)
- [x] Lint passando com 0 erros (`npm run lint`)
- [x] Build de produção passando (`tsc -b && vite build`)
- [x] Validação E2E no navegador (DevTools MCP) confirmando banner verde, troca de marca e ausência de erros 409.

### 🛒 (13/09/2026) Feature: Cotação de Preços no Tenda Atacado na Lista de Compras

#### Arquitetura
```mermaid
graph TD
    A["ListPageNew (Lista de Compras)"] --> B["ShoppingListView"]
    B -->|"Botão Preços Tenda"| C["TendaPriceDrawer"]
    C -->|"Consulta CEP (ex: 13064-789)"| D["tendaService: resolveTendaBranchByCep"]
    D -->|"/api/tenda"| E["Vite Proxy (Dev) / Vercel Edge api/tenda.ts (Prod)"]
    E -->|"API Pública Tenda"| F["Loja Ceasa - Campinas (#40) + Frete R$ 14,90"]
    C -->|"quoteShoppingItemOnTenda"| D
    D -->|"Extrai Medida + Filtra Tamanho + Ordena Menor Preço"| G["Top 5 Ofertas Mais Baratas"]
    G -->|"Exibe 'A partir de R$ X,XX' + Link Direto"| C
    C -->|"Usar Preço"| A
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `api/tenda.ts` | **Criado**: Proxy serverless Vercel Edge com CORS liberado e cache de 5 minutos para as rotas do Tenda Atacado. |
| `vite.config.ts` | Adicionado proxy `/api/tenda` para desenvolvimento local apontando para `https://api.tendaatacado.com.br/api`. |
| `src/services/tendaService.ts` | **Criado**: Serviço tipado para resolução de filial por CEP, busca de produtos, extração de peso/medida e cotação inteligente. |
| `src/services/tendaService.test.ts` | **Criado**: 12 testes unitários cobrindo extração de medidas, filtro estrito de peso e ordenação por menor preço. |
| `src/components/TendaPriceDrawer/TendaPriceDrawer.tsx` | **Criado**: Drawer lateral com cotação dos itens da lista, badge da loja/frete, links oficiais e botão para sincronizar preço. |
| `src/components/TendaPriceDrawer/TendaPriceDrawer.test.tsx` | **Criado**: Testes unitários para renderização e aplicação de preços. |
| `src/features/inventory/components/shoppingListView/ShoppingListView.tsx` | Adicionado botão de ação "Preços Tenda". |
| `src/pages/ListPageNew.tsx` | Integração do estado do Drawer, mapeamento de itens da lista e handlers para aplicar preço unitário ou em lote. |

#### Lógica de Decisão
#### Lógica de Decisão e Cache
```text
RESOLUÇÃO DE LOJA:
1. Usuário informa CEP (padrão: 13064-789).
2. API shipping-options identifica a filial de entrega (Ceasa - Campinas, ID 40) e frete.

FILTRAGEM DE PESO E PREÇO:
1. Extrai peso/medida do item da lista (ex: "Arroz Namorado 5kg" -> 5kg).
2. Busca na API do Tenda para a filial identificada.
3. Filtra apenas produtos com embalagem equivalente (evita falso positivo de 1kg ao cotar 5kg).
4. Ordena os candidatos pelo MENOR PREÇO (não pelos primeiros da vitrine).
5. Retorna o produto mais em conta como recomendado e lista os top 5 alternativos com links.

ESTRATÉGIA DE CACHE (EXPIRAÇÃO À MEIA-NOITE):
1. Preços e ofertas no atacado valem para o mesmo dia e expiram rigorosamente às 23:59:59.999.
2. Na virada do dia (00:00), o cache do localStorage descarta os dados e exige nova cotação.
3. Durante o mesmo dia, reabrir a gaveta ou navegar no app traz os dados instantaneamente (0ms sem requisição de rede).
4. Botão "Recotar Todos" ou "Tentar novamente" utiliza `bypassCache = true` para forçar busca fresca na API.
5. Na borda (Vercel Edge `api/tenda.ts`), o cabeçalho Cache-Control é dinamicamente calculado com `s-maxage` até a meia-noite (máx 7200s), evitando tráfego repetido na API do Tenda para todos os usuários.
6. Fila sequencial com throttle de 250ms entre produtos previne disparos concorrentes massivos.
```

#### Comportamento
- Botão "Preços Tenda" na Lista de Compras abre a gaveta lateral de cotação.
- Sistema consulta a filial e o frete correspondente ao CEP informado.
- Cada item da lista é pesquisado e exibe o menor valor ("A partir de R$ XX,XX"), link externo para conferir no site do Tenda Atacado e botão "Usar Preço".
- Resumo com subtotal dos itens cotados, frete estimado e total da compra.
- Respostas em cache válidas durante o dia corrente com aviso visual "(Preços válidos até as 23:59 de hoje)".

#### Checklist de Aceite
- [x] Zero erros TypeScript e ESLint (`npm run check` passando limpo).
- [x] Testes unitários adicionados e passando (`vitest run`).
- [x] Testes unitários adicionados e passando (19 testes cobrindo serviço, cache até meia-noite e gaveta).
- [x] Build de produção sem erros (`npm run build`).
- [x] Filtro estrito de peso/medida evitando distorções de embalagem (1kg vs 5kg).
- [x] Links oficiais para o Tenda com target blank.
- [x] Cache diário com expiração à meia-noite e bypassCache ao recotar.
- [x] Throttling de 250ms e travas atômicas com useRef prevenindo disparos em loop.


### 📝 (24/04/2026) Contexto Dinâmico (Meu vs Nosso Estoque)

#### Arquitetura
```mermaid
graph TD
    A["useAuthStore (userId)"] --> C["useAppMode()"]
    B["useGroupStore (groupId)"] --> C
    C -->|mode, appTitle, prefix| D["ComprasWebShell"]
    C -->|appTitle| E["AppHeader"]
    C -->|appTitle| F["InventoryFeatureApp"]
    C -->|appTitle| G["LoginPage"]
    D -->|"useSubdomainSync()"| H["document.title + URL sync"]
    I["sessionRules.ts"] -->|shouldSyncSubdomain| H
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `src/hooks/useAppMode.ts` | **Criado**: Hook central que determina modo (solo/shared) baseando-se no userId e groupId. |
| `src/hooks/useSubdomainSync.ts` | **Criado**: Hook para trocar a URL (via history.replaceState) e título da página dinamicamente. |
| `src/domain/sessionRules.ts` | Adicionada lógica de validação `shouldSyncSubdomain`. |
| `src/ComprasWebShell.tsx` | Aplica o hook de sincronização e injeta título dinâmico na Navbar. |

#### Lógica de Decisão
```
SE (userId existe E groupId existe) → "Nosso Estoque" (nossoestoque.apenasgabs.dev)
SE (groupId NÃO existe)             → "Meu Estoque"  (meuestoque.apenasgabs.dev)
```

#### Comportamento
- **Produção**: O subdomínio troca dinamicamente entre `meuestoque` e `nossoestoque` sem F5 (via History API).
- **Localhost/Preview**: O sistema detecta domínios não mapeados e não interfere na URL.
- **Transição**: A troca ocorre assim que o estado do grupo muda no Zustand.

#### Checklist de Aceite
- [x] O `AppHeader` exibe "Nosso Estoque" se em grupo.
- [x] O App não recarrega (Sem F5) na troca de contexto.
- [x] O TypeScript compila sem erros.
- [x] Testes E2E suportam ambos os títulos.

---

### 📝 (24/04/2026) Sincronização de Sessão (Bootstrap)

#### Lógica de Decisão
```
No carregamento inicial (mount):
1. Pega usuário atual do Supabase.
2. Lê a snapshot persistida localmente (getPersistedGroupSnapshotForUser).
3. Chama restoreGroupContext para sincronizar com o banco.
4. Redireciona para /list (se tem grupo) ou /group (se não tem grupo).
```

#### Arquivos Modificados
| Arquivo | Mudança / Propósito |
|---|---|
| `src/components/SessionBootstrap.tsx` | Contém o hook de inicialização da sessão e orquestração de grupos. |

---

> **DICA PARA A IA:** Ao implementar novas lógicas de estado global, pense se elas afetam `docs/ai/01_ARCHITECTURE_AND_DATA.md` ou `docs/ai/02_UX_AND_BUSINESS_RULES.md` e sinta-se livre para atualizar esses arquivos também.

### 📝 (24/04/2026) Correção de RLS em `items` + saneamento de contexto de lista

#### Arquitetura
```mermaid
graph TD
        A[SessionBootstrap/Login/Register] --> B[restoreGroupContext]
        B --> C[setGroup(groupId)]
        B --> D[setListId(context.listId or null)]
        E[ListPage/ListPageNew] --> F[ensureActiveListForGroup(groupId)]
        F --> G[setListId(activeListId)]
        G --> H[addListItem -> public.items]
        I[Migration phase_a_v2_rls_policy_cleanup] --> J[remove políticas legadas]
        I --> K[recria políticas V2 authenticated]
        K --> H
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `src/components/SessionBootstrap.tsx` | Remove fallback de `listId` persistido de outro contexto e mantém `listId` alinhado ao grupo resolvido. |
| `src/pages/LoginPage.tsx` | Remove fallback de `lastListId/listId` persistidos quando `context.group` já foi resolvido. |
| `src/pages/RegisterPage.tsx` | Mesmo ajuste do Login para evitar reaproveitar lista de outro grupo após autenticação. |
| `src/pages/ListPage.tsx` | Passa a resolver sempre a lista ativa pelo `groupId` antes de carregar/adicionar itens. |
| `src/pages/ListPageNew.tsx` | Mesma proteção da `ListPage`, com sincronização explícita de `setListId(activeListId)`. |
| `supabase/migrations/20260424_01_phase_a_v2_rls_policy_cleanup.sql` | Limpeza de policies legadas e padronização das policies V2 (authenticated) para `items`, `shopping_lists`, `stock_items`, `stock_lots`, `stock_movements`, `product_catalog`. |

#### Lógica de Decisão
```text
SE contexto do grupo foi resolvido (context.group existe)
    ENTÃO usar apenas context.listId (ou null)
    E NÃO reutilizar listId persistido de sessão anterior.

SE página de lista carregar com groupId
    ENTÃO sempre resolver activeListId via ensureActiveListForGroup(groupId)
    E sincronizar store com esse activeListId.

SE banco tiver políticas legadas + V2 na mesma tabela
    ENTÃO remover legadas
    E manter apenas política canônica V2 para role authenticated.
```

#### Comportamento
- O app não tenta mais inserir em `items` usando `list_id` antigo de outro grupo/sessão.
- A entrada na lista agora depende sempre da lista ativa real do grupo atual.
- O banco ficou com um conjunto único e consistente de policies RLS V2.
- O cenário que gerava `new row violates row-level security policy for table "items"` por desvio de contexto foi mitigado.

#### Checklist de Aceite
- [x] Policies legadas removidas nas tabelas-alvo.
- [x] Policies V2 recriadas e validadas (`authenticated`).
- [x] Migração aplicada no Supabase (`phase_a_v2_rls_policy_cleanup`).
- [x] Fluxo de bootstrap/login/register sem fallback perigoso de `listId`.
- [x] List pages resolvendo lista ativa por `groupId`.

---

### 📝 (03/05/2026) Arquitetura E2E com State Injection

> Documentacao completa: `docs/ai/06_E2E_TESTING.md`

#### Arquitetura
```mermaid
graph TD
    subgraph "state/"
        S1["auth.state"] --> DB["Supabase Admin"]
        S2["group.state"] --> DB
        S3["list.state"] --> DB
        S4["stock.state"] --> DB
        S5["cleanup.state"] --> DB
    end
    subgraph "screens/"
        SC1["auth.screen"]
        SC2["group.screen"]
        SC3["list.screen"]
        SC4["stock.screen"]
    end
    subgraph "scenarios/"
        T1["auth.spec (7)"]
        T2["groups.spec (8)"]
        T3["list.spec (7)"]
        T4["stock.spec (7)"]
        T5["flows.spec (3)"]
    end
    T1 --> S1 & SC1
    T2 --> S2 & SC2
    T3 --> S3 & SC3
    T4 --> S4 & SC4
    T5 --> S1 & S4 & SC1 & SC3 & SC4
```

#### Arquivos Criados

| Diretorio | Arquivo | Proposito |
|---|---|---|
| `e2e/config/` | `supabaseAdmin.ts` | Cliente admin com `service_role` key |
| `e2e/fixtures/` | `testData.ts` | Geradores deterministicos de dados de teste |
| `e2e/state/` | `auth`, `group`, `list`, `stock`, `cleanup` | Seed/cleanup direto no Supabase |
| `e2e/screens/` | `auth`, `group`, `list`, `stock`, `navigation`, `profile` | Acoes atomicas de UI |
| `e2e/scenarios/` | `auth`, `groups`, `list`, `stock`, `flows` | 32 cenarios E2E declarativos |

#### Scripts NPM Adicionados

| Script | Descricao |
|---|---|
| `npm run e2e:auth` | 7 testes de autenticacao |
| `npm run e2e:groups` | 8 testes de gestao de grupos |
| `npm run e2e:list` | 7 testes de lista de compras |
| `npm run e2e:stock` | 7 testes de estoque |
| `npm run e2e:flows` | 3 testes cross-domain |
| `npm run e2e:all` | Todos os 32 testes |

#### Logica de Decisao
```text
SEED: Sempre via supabaseAdmin (service_role) para bypasear RLS.
SCREEN: Funcoes puras, 1 acao por funcao, sem estado interno.
SCENARIO: Composicao declarativa de state + screen.
ISOLAMENTO: Cada test.describe cria seu usuario/grupo; afterAll limpa tudo.
```

#### Checklist de Aceite
- [x] TypeScript compila com zero erros (`tsc --noEmit`).
- [x] 32 cenarios implementados em 5 dominios.
- [x] 6 arquivos de screen com funcoes atomicas.
- [x] 5 arquivos de state com seed/cleanup via admin API.
- [x] Scripts NPM adicionados ao `package.json`.
- [x] Documentacao completa em `docs/ai/06_E2E_TESTING.md`.
- [x] `.env.example` atualizado com variaveis necessarias.



### 📝 (04/05/2026) Melhorias na Gestão de Grupos

#### Arquitetura
```mermaid
graph TD
    A[ProfilePage] -->|Gerenciar Grupos| B[GroupPage]
    B -->|Join/Create| C[Supabase Groups]
    B -->|Leave| D[group_members DELETE]
    B -->|Delete| E[groups DELETE]
    B -->|Switch| F[useGroupStore setGroup]
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `src/pages/ProfilePage.tsx` | Adicionado link "Gerenciar Grupos" para facilitar acesso. |
| `src/pages/GroupPage.tsx` | Layout reorganizado; Adicionados botões "Sair" e "Excluir" na lista de grupos. |
| `src/lib/webData.ts` | Adicionada função `deleteGroup`. |
| `supabase/migrations/20260504_01_allow_group_deletion.sql` | **Criado**: Habilita política RLS para exclusão de grupos por membros; Backfill de `created_by` usa o membro mais antigo (`entrou_em`). |

#### Lógica de Decisão
```text
SAIR: Remove apenas o vínculo do usuário (group_members).
EXCLUIR: Remove o grupo e TODOS os dados relacionados (CASCADE). Exige confirmação.
VISIBILIDADE: Join/Create sempre disponíveis no GroupPage, independente do estado ativo.
```

#### Comportamento
- Usuário pode gerenciar múltiplos grupos sem ser bloqueado pelo estado "em grupo".
- Acesso rápido via Perfil -> Gerenciar Grupos.
- Confirmações críticas para evitar perda de dados.

#### Checklist de Aceite
- [x] Link no perfil funcionando.
- [x] Botão "Sair" remove do grupo e limpa estado se ativo.
- [x] Botão "Excluir" remove permanentemente e limpa estado.
- [x] Layout do `GroupPage` responsivo e intuitivo.
- [x] Migration de RLS criada.
- [x] TypeScript compila sem erros nos arquivos alterados.

---

### 📝 (04/05/2026) Redesign dos Cards de Estoque

#### Arquitetura (Layout do Card)
```mermaid
graph TD
    A[ProductCard] --> B[Linha 1: Nome + Badges]
    A --> C[Linha 2: Barra de Progresso Fina]
    A --> D[Linha 3: Qtd + Unidade + Ações]
    D --> D1[🛒 Shopping]
    D --> D2[📊 Histórico]
    D --> D3[✏️ Editar]
    D --> D4[🗑️ Excluir]
```

#### Arquivos Modificados

| Arquivo | Mudança / Propósito |
|---|---|
| `src/features/inventory/components/productCard/ProductCard.tsx` | Redesign completo do layout para maior densidade e clareza. |
| `src/features/inventory/components/stockView/StockView.tsx` | Redução de padding e espaçamento global da view de estoque. |

#### Lógica de Decisão
```text
DENSIDADE: Redução de padding (p-4 -> p-2) e spacing (y-4 -> y-2) para exibir mais itens.
LAYOUT: Unidade colada na quantidade; Ícones agrupados à direita; Data de compra removida.
VISUAL: Barra de progresso ultra-fina (h-1) para manter o contexto sem poluir.
```

#### Checklist de Aceite
- [x] Unidade exibida ao lado da quantidade.
- [x] Data de compra removida.
- [x] Ícones 🛒 �� ✏️ 🗑️ organizados em linha.
- [x] Barra de progresso fina implementada.
- [x] Lint passando (zero erros).
- [x] Responsividade mantida em telas pequenas.

---

### 📝 (04/05/2026) Ajuste Visual da Barra de Progresso

#### Mudança
A porcentagem de estoque (ex: 70%) foi movida de cima da barra para **atrás** dela, centralizada horizontalmente.

#### Lógica de Decisão
```text
VISUAL: O texto age como um "marca d'água" sutil (opacity-10) no fundo da barra.
COMPACTAÇÃO: Permite que a barra e a porcentagem ocupem o mesmo espaço vertical, reduzindo a altura total do card.
```

#### Arquivos Modificados
| Arquivo | Mudança |
|---|---|
| `src/features/inventory/components/productCard/ProductCard.tsx` | Reposicionamento do span de porcentagem para dentro do container da barra com z-index inferior. |

---

### 📝 (05/05/2026) Correção de Permissões e Falha Silenciosa na Exclusão de Grupos

#### Arquitetura
```mermaid
graph TD
    A[GroupPage] -->|Check Ownership| B{group.created_by === userId?}
    B -->|Yes| C[Render Excluir Button]
    B -->|No| D[Hide Excluir Button]
    C -->|Click| E[deleteGroup RPC/Delete]
    E -->|Supabase Delete| F{RLS Check}
    F -->|Blocked / 0 rows| G[Throw Error: Sem Permissão]
    F -->|Success / 1 row| H[Clear Local State + Refresh]
    G -->|Caught| I[Show Alert Error]
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `src/domain/sessionRules.ts` | Adicionado `created_by` à interface `GroupRecord`. |
| `src/stores/groupStore.ts` | Adicionado `created_by` à interface `WebGroupRecord`. |
| `src/lib/webData.ts` | Atualizado `loadUserGroups` para buscar `created_by`; `deleteGroup` agora valida se a linha foi realmente deletada. |
| `src/pages/GroupPage.tsx` | Implementada renderização condicional do botão "Excluir" baseada no `userId`. |

#### Lógica de Decisão
```text
VISIBILIDADE: O botão "Excluir" só deve aparecer para o criador do grupo (dono).
SEGURANÇA: deleteGroup() agora usa .select("id") para garantir que a deleção foi processada pelo Supabase.
ESTADO: O estado local (active group) só é limpo se a deleção no banco de dados for confirmada com sucesso.
```

#### Comportamento
- Usuários que não criaram o grupo não veem mais a opção de excluí-lo (apenas "Sair").
- Se por algum motivo (bug ou bypass) um não-dono tentar excluir, o backend/RLS bloqueia e o frontend agora exibe um erro em vez de limpar o estado e deixar o usuário "sem grupo".

#### Checklist de Aceite
- [x] `created_by` sendo populado no carregamento de grupos.
- [x] Botão "Excluir" oculto para não-donos.
- [x] `deleteGroup` lança erro se o RLS bloquear a deleção (zero rows affected).
- [x] Estado local preservado em caso de falha na deleção.
- [x] TypeScript compila sem erros (interfaces sincronizadas).
- [x] Lint passando (zero erros).

---

### 📝 (05/05/2026) Atualização da Pipeline CI/CD (Deploy Manual/Forçado)

#### Arquitetura
```mermaid
graph TD
    A[Gatilho: Push ou Manual] --> B{force_deploy == true?}
    B -- Sim --> C[Job: Deploy Vercel]
    B -- Não --> D{Semantic Release gerou tag?}
    D -- Sim --> C
    D -- Sim --> E[Job: Testes Unitários]
    E --> F[Job: Testes E2E]
    D -- Não --> G[Fim: Nada a fazer]
```

#### Arquivos Modificados / Criados

| Arquivo | Mudança / Propósito |
|---|---|
| `.github/workflows/release.yml` | Adicionado `workflow_dispatch` e lógica condicional para `force_deploy`. |

#### Lógica de Decisão
```text
DEPLOYS:
Ocorre se (nova_tag_gerada == true) OU (force_deploy == true).

TESTES (Unitários e E2E):
Ocorrem APENAS se (nova_tag_gerada == true).
O force_deploy ignora a bateria de testes para agilizar correções manuais ou deploys de emergência que não geram tag.
```

#### Comportamento
- Adicionado botão "Run workflow" no GitHub Actions com checkbox "Forçar deploy".
- Se marcado, a Vercel recebe o código atual da `main` imediatamente.
- O fluxo padrão de commit (feat/fix) continua exigindo testes e gerando tags automáticas.

#### Checklist de Aceite
- [x] `workflow_dispatch` configurado corretamente.
- [x] Input `force_deploy` disponível na UI do GitHub.
- [x] Job de Deploy aceita ambas as condições (tag ou manual).
- [x] Jobs de Teste continuam protegidos e vinculados apenas a novas versões.
- [x] YAML validado.

---

### 📝 (12/05/2026) Correção de Inicialização do Supabase e Robustez de Env Vars

#### Arquitetura
```mermaid
graph TD
    A[Vercel/Build] --> B{VITE_SUPABASE_URL?}
    B -- "" (Empty) --> C[Fallback: localhost]
    B -- undefined --> C
    B -- "https://..." --> D[Real Supabase]
    C & D --> E[createClient]
```

#### Arquivos Modificados
| Arquivo | Mudança / Propósito |
|---|---|
| `src/lib/supabase.ts` | Troca de `??` por `||` para tratar strings vazias; Melhora log de aviso. |
| `vercel.json` | Identificada configuração de `ignoreCommand` que pode estar bloqueando deploys de produção. |

#### Lógica de Decisão
```text
PROBLEMA: createClient() lança "supabaseUrl is required" se receber string vazia.
SOLUÇÃO: O operador || (OR) garante que "" ou undefined caiam no fallback de localhost.
ALERTA: Se o app cair no fallback em produção, ele não conectará, mas evitará o Crash (White Screen).
```

#### Comportamento
- O app não crasha mais na Vercel com "Uncaught Error: supabaseUrl is required".
- Se as variáveis `VITE_` estiverem faltando, um aviso é exibido no console.
- Sugestão de revisão do `vercel.json` para garantir que builds de produção ocorram.

#### Checklist de Aceite
- [x] Troca de operador `??` -> `||` aplicada.
- [x] `import.meta.env` usado diretamente no check de warning.
- [x] Código compilando sem erros.

---

### 📝 (24/05/2026) Correção de Race Condition no Consumo de Estoque

#### Arquitetura
```mermaid
graph TD
    A[UI Consumo Rápido] -->|Cliques Rápidos| B(Zustand: updateItemQuantity)
    B -->|Debounce| C[API: recordStockMovement]
    C -->|RPC: consume_stock_fifo| D{Lotes suficientes?}
    D -- Sim --> E[Atualiza Lotes e Movimentações]
    D -- Não --> F[Fallback: Atualiza stock_items e insere Movimentação sem Lote]
    E & F --> G[getStockItems]
    G -->|Zustand: merge com| H(applyPendingMovements)
    H --> I[Estado Local Sincronizado]
```

#### Arquivos Modificados
| Arquivo | Mudança / Propósito |
|---|---|
| `src/stores/stockStore.ts` | Criada a função `applyPendingMovements` para mesclar mudanças otimistas pendentes sobre os dados recém buscados da API. Mantida a semântica correta de limpeza do `lastAutoAddedItemName`. |
| `supabase/migrations/20260524_01_atomic_consume_stock_fifo.sql` | Atualiza a RPC `consume_stock_fifo` para absorver de forma atômica o consumo "sem lote" (fallback), inserindo um movimento e ajustando a `stock_items.quantidade` diretamente no Postgres. |

#### Lógica de Decisão
```text
PROBLEMA 1: Cliques rápidos acumulavam deltas, mas quando a API retornava, o Zustand sobreescrevia o estado com dados defasados.
SOLUÇÃO 1: Antes de fazer `set(items)`, aplicar os deltas de `pendingStockMovements` aos itens retornados.

PROBLEMA 2: Fallback de consumo no frontend não era atômico (um update + um insert separados), podendo gerar inconsistência.
SOLUÇÃO 2: A lógica inteira de consumo (incluindo o que sobra se faltarem lotes) foi movida para dentro da RPC `consume_stock_fifo`, garantindo 100% de consistência transacional.
```

#### Comportamento da Feature
- O usuário pode clicar múltiplas vezes rapidamente no botão "Consumir"; a interface deduzirá a quantidade otimisticamente sem "pulos" visuais quando a requisição de background resolver.
- Itens criados manualmente (sem lote) agora podem ser consumidos normalmente, decrementando sua quantidade na base de dados de forma confiável.

#### Checklist de Aceite
- [x] Race condition no update otimista mitigada com mesclagem local (`applyPendingMovements`).
- [x] Fallback no Supabase funcionando para itens sem registro em `stock_lots`.
- [x] Scripts de build e lint executados sem erros (`npm run lint && npm run build`).

---

### 📦 (30/05/2026) Feature: Unidade de Compra vs Unidade de Estoque (Embalagens)

**Resumo:** O usuário pode agora informar na lista de compras que está comprando uma unidade agregada (ex: `1 pacote` ou `1 fardo`), mas que seu rendimento para controle de estoque será convertido numa unidade menor (ex: `5 kg` ou `10 un`). Isso evita distorções ao consumir o estoque.

#### Arquivos Modificados
| Arquivo | Mudança / Propósito |
|---|---|
| `supabase/migrations/20260531_01_add_pack_fields_to_items.sql` | Migration para adicionar `pack_label`, `pack_size`, e `pack_unit` na tabela `items` (Lista de Compras). |
| `src/lib/webData.ts` | Refatoração da função `finishShoppingList` para dar prioridade ao fator de conversão inserido (`item.pack_size`) antes de procurar o fator padrão do catálogo (`stock_item.pack_size`). Criação da RPC wrapper `updateListItemPackSize`. |
| `src/features/inventory/components/shoppingListItem/ShoppingListItem.tsx` | Adicionado botão inline "📦" com inputs extras para declarar o nome e rendimento do pacote (ex: "caixa", 12 un) durante a compra, mostrando a conversão `2 × 5 kg = 10 kg` em tempo real. |
| `src/domain/shoppingImportParser.ts` | Adicionado suporte ao padrão visual de quantidade-vezes-fator na entrada rápida, extraindo valores na sintaxe `2x5kg` ou `2X5Kg` gerando automaticamente 2 pacotes de 5 kg. |
| `src/features/inventory/components/productCard/ProductCard.tsx` | UI do Estoque atualizada para exibir o sumário em "pacotes". Em vez de `10 kg`, agora exibe `2 pacotes (10 kg)` se o item possuir `pack_size` igual a 5 configurado. |
| `src/features/inventory/components/productFormModal/ProductFormModal.tsx` | Seção de "Unidade Composta" refatorada para UX mais clara, voltada para "Embalagem (Rendimento)". |

#### Lógica de Decisão
```text
PROBLEMA: Usuário compra "1 pacote de 5kg de arroz" e relata comprar como "pacote", mas consome em "gramas/kg".
SOLUÇÃO: O usuário declara os campos pack_label e pack_size na hora da compra. A lista usa a unidade comprada visualmente. Na finalização (finishShoppingList), multiplica-se `quantidade * pack_size` para inserir os dados no estoque em unidades menores de consumo.
```

#### Comportamento da Feature
- Smart input aceita `Arroz, 2x5kg` na Lista de Compras, mapeando 2 quantidades e 5 como `packSize`.
- Ao finalizar lista, as embalagens são "desempacotadas" pro lote: um fardo de 12 rolos entra como 12 unidades (un).
- No Estoque, é exibido ao usuário `3.2 pacotes (16 kg)` para ajudar na visualização de caixas/fardos.

#### Checklist de Aceite
- [x] Banco de dados e schema de tipos (`items`) atualizados via migration versionada.
- [x] Parser interpretando formato string corretamente (`NxYunit`).
- [x] Front-end renderizando os campos e callback sem erros React de estado (JSX otimista).
- [x] Scripts de build e lint executados sem erros.

### 📝 (14/09/2026) Adição de Ferramenta Bulk no MCP e Fix de Schemas

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `src/mcp/tools/*.ts` | Adição do campo opcional `group_id` nos schemas do Zod |
| `src/mcp/tools/list.ts` | Criação da tool `bulk_add_items_to_list` |

#### Lógica de Decisão
- Antes, a IA ficava em loop pois o SDK validava estritamente o schema Zod e rejeitava o `group_id`.
- Além disso, adicionar 40 itens um a um da lista de exemplo gerava um timeout/loop visual para o LLM. A nova tool `bulk_add_items_to_list` permite inserir o array completo em uma única call RPC.

#### Checklist de Aceite
- [x] Lint passando
- [x] Testes passando
- [x] Build sem erros

### 📝 (14/09/2026) Correção de Assinatura das Ferramentas no MCP Server

#### Arquitetura
```mermaid
graph TD
    Client[Cliente MCP] -->|JSON-RPC tools/call| Edge[Vercel Edge Handler]
    Edge --> Server[McpServer.registerTool]
    Server --> Handler[Tool Callback com extra.authInfo]
    Handler --> Supabase[Supabase Client Autenticado]
```

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `src/mcp/tools/list.ts` | Correção da assinatura de `registerTool` (inputSchema dentro de config) |
| `src/mcp/tools/stock.ts` | Correção da assinatura de `registerTool` (inputSchema dentro de config) |
| `src/mcp/tools/insights.ts` | Correção da assinatura de `registerTool` (inputSchema dentro de config) |

#### Lógica de Decisão
- `@modelcontextprotocol/server` espera 3 argumentos: `(name, config, callback)`, onde `inputSchema` fica obrigatoriamente dentro de `config`.
- Antes, `schema` era passado como 3º argumento e o handler como 4º. Isso fazia o endpoint retornar `inputSchema: {}` no `tools/list` e lançar `n is not a function` na invocação da ferramenta.

#### Checklist de Aceite
- [x] Lint passando
- [x] Testes passando (156 testes)
- [x] Build sem erros

### 📝 (12/10/2026) Autenticação Persistente do MCP via API Keys (issue #36)

#### Arquitetura
```mermaid
graph TD
    A[Cliente MCP] -->|Bearer mest_pat_| B[api/mcp.ts]
    B --> C[src/mcp/auth.ts]
    C -->|rpc exchange_mcp_api_key| D[(Postgres + Vault)]
    D -->|JWT HS256 5min| C
    C -->|cliente com JWT curto| E[Tools com RLS]
    F[ProfilePage / McpKeysSection] -->|create/revoke RPC| D
```

#### Arquivos Modificados / Criados
| Arquivo | Mudança / Propósito |
|---|---|
| `supabase/migrations/20261012_01_mcp_api_keys.sql` | Tabela `mcp_api_keys`, RLS somente SELECT, RPCs de criar/revogar/trocar, HS256 em plpgsql |
| `src/mcp/auth.ts` | Aceita `mest_pat_`; troca por JWT curto; erros genéricos (`McpAuthError`); JWT de sessão deprecado |
| `src/mcp/context.ts` | `extractContext` compartilhado e `extractWriteContext` (escopo `write`) |
| `src/mcp/tools/*.ts` | Usam helpers compartilhados; tools de escrita exigem `write`; corrigidos `remove_item_from_list` (assinatura) e `consume_stock_item` (lançava erro sempre) |
| `api/mcp.ts` | Sem CORS `*`, sem `any`, 401 genérico, erro interno não é mais mascarado como 401 |
| `src/lib/mcpKeys.ts` | Serviço de chaves (list/create/revoke/revokeAll, status, config JSON) |
| `src/components/McpKeysSection/McpKeysSection.tsx` | UI de gerenciamento; segredo exibido uma vez em modal |
| `src/pages/ProfilePage.tsx` | Remove exposição do access_token da sessão; usa `McpKeysSection` |
| `docs/features/feature-mcp-persistent-tokens.md` | Especificação e setup obrigatório do Vault |

#### Lógica de Decisão
```text
REGRA: Token começa com mest_pat_ -> valida regex -> RPC exchange -> JWT 5 min -> RLS normal
REGRA: Qualquer falha de credencial -> 401 "Unauthorized" sem motivo
REGRA: Escrita via MCP exige escopo write
REGRA: Chave expira em 1..365 dias; máximo 10 ativas por usuário
REGRA: Nenhum service_role nem secret de assinatura no Vercel (secret fica no Vault: mcp_jwt_secret)
```

#### Comportamento
- Usuário cria chaves nomeadas no Perfil (validade e somente leitura opcionais) e copia chave, JSON ou prompt.
- Revogação tem efeito no request seguinte (sem cache).
- Requer setup único: `vault.create_secret('<HS256 secret aceito pelo projeto>', 'mcp_jwt_secret')`.

#### Checklist de Aceite
- [x] Lint passando
- [x] Testes novos passando (11 Vitest + 17 checagens SQL em PGlite); 66 falhas pré-existentes em 4 arquivos (ex: ThemeSelector) não relacionadas
- [x] Build sem erros

# 🤖 Base de Conhecimento e Log para IAs (AI Knowledge Base)

**ATENÇÃO, IA LENDO ESTE ARQUIVO:** Se você está trabalhando neste projeto, **você DEVE** consultar a documentação listada abaixo antes de alterar o código do sistema e **atualizar este arquivo** sempre que modificar regras ou infraestrutura importante!

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

# Setup do Meu Estoque

Guia para preparar um ambiente de desenvolvimento local funcional, conectado ao Supabase.

## 1. Pré-requisitos

- **Node.js v24+**.
- **npm** (ou `pnpm`/`yarn`, scripts assumem `npm`).
- **Conta no Supabase** com um projeto criado.
- **Supabase CLI** opcional, mas necessário para rodar migrations localmente.
- (Opcional) `git` e `gh` (GitHub CLI).

## 2. Clonar e instalar

```bash
git clone https://github.com/ApenasGabs/meuestoque.git
cd meuestoque
npm install
```

## 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Variáveis essenciais (em `.env` na raiz):

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública do projeto. |

> Não comite chaves reais. O `.env` está no `.gitignore`.

As variáveis `TABLET_*`, `PLAYWRIGHT_APP_URL`, `E2E_*` são apenas para E2E remoto.

## 4. Banco de dados (Supabase)

O schema é versionado em `supabase/migrations/`.

### Opção A — Supabase CLI (recomendado)

```bash
supabase link --project-ref <seu-ref>
supabase db push
```

### Opção B — SQL Editor

Cole cada arquivo de `supabase/migrations/` no SQL Editor do dashboard, na ordem cronológica.

### Opção C — Banco local (Docker)

```bash
supabase start
supabase db reset
```

### Validação

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('product_catalog','stock_items','items')
  AND column_name IN ('perecivel','validade_padrao_dias',
                      'data_validade_alerta','validade_nao_aplica',
                      'data_validade','nao_aplica_validade');

SELECT proname FROM pg_proc
WHERE proname IN ('rpc_finalize_shopping_list','rpc_bulk_update_stock_validity','is_group_member');
```

Detalhes das RPCs em [`docs/ai/04_RPC_CONTRACTS.md`](./ai/04_RPC_CONTRACTS.md).

## 5. Primeiro grupo de teste

1. `npm run dev` e abra `http://localhost:5173`.
2. Registre uma conta.
3. Crie um grupo (gera `codigo_convite`).
4. Convide outros usuários colando o código.
5. Cadastre produtos para validar lista → finalização → estoque.

## 6. Scripts úteis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor Vite em watch. |
| `npm run build` | Type-check + build. |
| `npm run preview` | Servir o build. |
| `npm run lint` | ESLint. |
| `npm run lint:fix` | ESLint com autofix. |
| `npm run test` | Vitest em watch. |
| `npm run test:coverage` | Cobertura. |
| `npm run e2e` | Playwright E2E. |
| `npm run e2e:ui` | Playwright com UI. |

## 7. IDE recomendada

VS Code com ESLint, Prettier, Tailwind CSS IntelliSense.

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": true }
}
```

## 8. Convenções

- Conventional Commits.
- Branches: `feature/*`, `fix/*`, `docs/*`.
- Releases via Semantic Release ao mergear na `main`.

## 9. Próximos passos

- [`docs/FEATURES.md`](./FEATURES.md) — visão de produto.
- [`docs/ai/01_ARCHITECTURE_AND_DATA.md`](./ai/01_ARCHITECTURE_AND_DATA.md) — arquitetura.
- [`docs/GLOSSARY.md`](./GLOSSARY.md) — termos do domínio.
- [`docs/adr/`](./adr/) — decisões arquiteturais.

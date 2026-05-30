# Código e Padrões do Projeto — Resumo Rápido

Este arquivo é um resumo condensado dos padrões e locais de referência do projeto. Destinado a IAs e desenvolvedores que chegam ao repositório e precisam de um checklist mínimo antes de alterar código.

Principais documentos a ler (ordem recomendada)
- `AI_KNOWLEDGE_BASE.md` — regras de documentação, logs e decisões de arquitetura.
- `.github/copilot-instructions.md` — regras específicas de estilo, segurança e workflow do repositório.
- `AGENTS.md` — políticas obrigatórias para agentes/IA (arquivo na raiz e em `.github/`).
- `README.md` — visão geral e setup rápido.

Regras de codificação essenciais
- TypeScript: **NUNCA** usar `any`. Usar `unknown` quando necessário; tipar todos os parâmetros e retornos.
- Funções: usar **arrow functions** em todo o código (evitar `function` tradicional).
- Acessibilidade: `aria-label` em elementos interativos sem texto; `alt` em imagens.
- UI: priorizar componentes internos e `daisyUI` conforme `.github/copilot-instructions.md`.

Commits e Pull Requests
- Mensagens: seguir Conventional Commits (imperativo/presente). Exemplos: `feat: ✨ adiciona scanner de código de barras`.
- Antes de commitar: `git pull`, `npm run lint`, `npm test`, `npm run build`.
- PR: sempre incluir checklist e referenciar `AI_KNOWLEDGE_BASE.md` se alterar regras de negócio.

Tests e CI
- Testes unitários: Vitest (`npm run test`); E2E: Playwright (`npm run e2e`).
- Pipeline de Release: `.github/workflows/release.yml` — novas tags disparam jobs (build, tests, deploy).
- Adicionar snapshot do schema: `scripts/inspect-supabase.js` roda via CI quando tag é criada (job `inspect-db`).

Segurança e segredos
- Nunca commitar chaves/segredos. Use GitHub Secrets e `.env` local (já listado em `.gitignore`).
- Alertar imediatamente sobre XSS, SQL injection, exposição de credenciais.

Banco de dados / Migrations
- `supabase/migrations/` é a fonte de verdade para migrations; porém o banco pode ter drift — use `npm run inspect:supabase` para gerar snapshot e comparar.
- Procedimento recomendado: gerar snapshot, criar migration corretiva em `supabase/migrations/`, abrir PR com justificativa no `docs/supabase_inspection_results_*.json`.

Pasta e padrões úteis
- `src/` — código TypeScript/React.
- `docs/` e `docs/ai/` — documentação técnica e regras de negócio.
- `scripts/` — scripts utilitários (ex: `inspect-supabase.js`, `install-extensions.js`).
- `supabase/` — migrations e configuração do projeto Supabase.

Checks automáticos que a IA deve executar antes de alterar código
1. Ler `AI_KNOWLEDGE_BASE.md` e `.github/copilot-instructions.md`.
2. Verificar se há migrations relevantes em `supabase/migrations/`.
3. Rodar `npm run lint` e `npm test` localmente (ou via CI).
4. Propor commit message e esperar aprovação humana antes de `git push`.

Onde atualizar esta referência
- Se você alterar regras de negócio, adicione entrada em `AI_KNOWLEDGE_BASE.md` e atualize este arquivo quando relevante.

---

Arquivo criado automaticamente pelo assistente para facilitar futuras interações automatizadas. Se quiser, eu já crio um PR com esta adição na sua branch atual; autoriza? 

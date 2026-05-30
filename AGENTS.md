# AGENTS — Guia obrigatório para IAs (arquivo na raiz)

Coloquei este arquivo na raiz do repositório para que agentes e integrações que indexam o projeto a partir da raiz o encontrem facilmente.

Resumo curto (regras obrigatórias)

- Antes de iniciar qualquer alteração de código, **LEIA** `AI_KNOWLEDGE_BASE.md` e `.github/copilot-instructions.md`.
- Crie um plano de tarefas e apresente-o ao usuário antes de aplicar mudanças.
- Proponha a mensagem de commit e aguarde aprovação explícita antes de commitar.

Onde agentes normalmente procuram quando iniciam

- Repositório raiz: arquivos como `README.md`, `AGENTS.md`, `AI_KNOWLEDGE_BASE.md` e top-level docs.
- Diretório `.github/` (ex.: `.github/AGENTS.md`, `.github/copilot-instructions.md`).
- `docs/` e `docs/ai/` para regras de negócio e contratos.

Observação sobre Gemini e outros modelos: modelos de linguagem não "navegam" o repositório por conta própria; ferramentas e integrações (IDEs, agentes ou pipelines) que usam modelos geralmente começam indexando a raiz do repositório e arquivos de alto nível (`README.md`, `AI_KNOWLEDGE_BASE.md`, `AGENTS.md`). Portanto, colocar regras na raiz maximiza a chance de serem encontradas.

Checklist mínimo antes de finalizar uma alteração

- [ ] Plano de tarefas criado e aprovado
- [ ] Mensagem de commit proposta e aprovada
- [ ] Lint passando (`npm run lint`)
- [ ] Testes unitários passando (`npm test`)
- [ ] Build sem erros (`npm run build`)

Se quiser, posso também inserir uma menção a `AGENTS.md` no `README.md` para reforçar. 

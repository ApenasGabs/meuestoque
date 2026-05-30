# AGENTS — Guia obrigatório para IAs

## Objetivo

Este arquivo descreve regras mínimas que qualquer agente (IA) deve seguir antes de modificar ou adicionar código neste repositório.

## Regra obrigatória

- Antes de iniciar qualquer alteração de código, **LER** a documentação técnica central: `AI_KNOWLEDGE_BASE.md`.
- Também leia obrigatoriamente: `.github/copilot-instructions.md`.

Esses documentos contêm regras de negócio, padrões de segurança, padrões de commit e arquivos que **NÃO** devem ser alterados por agentes automatizados.

## Passos que TODO agente deve executar

1. Abrir e ler: `AI_KNOWLEDGE_BASE.md` — compreender regras de domínio e validações.
2. Abrir e ler: `.github/copilot-instructions.md` — seguir instruções específicas do repositório.
3. Explorar rapidamente o repositório para identificar onde aplicar mudanças.
4. Criar um plano de tarefas usando o `manage_todo_list` (ou equivalente) e apresentá-lo ao usuário para aprovação.
5. Propor uma mensagem de commit e aguardar confirmação antes de commitar.
6. Executar a suíte mínima: lint, testes unitários e build localmente (ex.: `npm run lint`, `npm test`, `npm run build`).
7. Reportar qualquer vulnerabilidade encontrada antes de fazer mudanças (ex.: XSS, chaves/segredos, SQL injection).

## Arquivos sensíveis (NÃO modificar sem aprovação humana)

- `.clinerules` e `.codelinterrules` — NÃO modificar por agentes automatizados.
- Arquivos de configuração de CI/CD e secrets.

## Checklist mínimo antes de finalizar uma alteração

- [ ] Confirmação do usuário para commitar
- [ ] Lint sem erros
- [ ] Testes unitários passando
- [ ] Build bem-sucedido
- [ ] Mudanças documentadas em `AI_KNOWLEDGE_BASE.md` se alteram regras de negócio

## Links técnicos relevantes

- Documentação técnica principal: `AI_KNOWLEDGE_BASE.md`
- Instruções do Copilot: `.github/copilot-instructions.md`

## Modelo de mensagem inicial para o usuário

"Tenho um plano de tarefas que descreve as mudanças propostas. Primeiro confirme que devo prosseguir; em seguida, informarei a mensagem de commit proposta e executarei os testes locais antes de solicitar permissão para commitar."

---

Se houver necessidade de integração adicional (ex.: adicionar uma seção deste guia em `README.md` ou criar um arquivo com políticas internas), peça aprovação e crie um PR para revisão humana.

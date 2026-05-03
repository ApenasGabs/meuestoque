
[![GitHub release](https://img.shields.io/github/v/release/ApenasGabs/meuestoque?style=flat-square)](https://github.com/ApenasGabs/meuestoque/releases)
[![License](https://img.shields.io/github/license/ApenasGabs/meuestoque?style=flat-square)](./LICENSE)

# 📦 Meu Estoque 

Um aplicativo híbrido que une **Lista de Compras**, **Controle de Estoque** e **Histórico Financeiro** focado no consumo doméstico. Projetado para resolver a fricção de entrada de dados com ferramentas de parser em tempo real e gerenciar a conversão inteligente de produtos a granel (peso vs. unidade).

## ✨ Principais Funcionalidades

* ⚡ **Input Inteligente (Parser v2):** Adição ultrarrápida via texto natural. Digitar `Tomate, 2, 8.50` cria automaticamente um item no estoque com quantidade e valor financeiro.
* ⚖️ **Unidade Composta:** Cálculos automáticos de conversão. Compre por quilo (ex: `2kg = 7 unidades, R$ 15,00`) e consuma por unidade. O sistema debita o peso exato (285g/un) e rastreia o custo fracionado.
* 🚨 **Gestão de Validade "Zero Fricção":** Itens recém-adicionados ganham uma tag `Pendente Validade` e são fixados no topo do estoque até que a data seja inserida, evitando o acúmulo de débito técnico nos dados.
* 🏷️ **Filtros e Categorização Dinâmica:** Filtros múltiplos por *Categoria* (Carnes, Hortifruti, etc.) e *Horário de Consumo* (Café, Almoço, etc.) via Chips na UI.
* 📉 **Histórico Financeiro:** Todo item no estoque reflete a data e o valor da última compra, gerando alertas de inflação pessoal caso o preço esteja defasado em mais de 30 dias.

## 🛠️ Stack Tecnológica

O front-end foi construído com foco em performance e estado gerenciado de forma simplificada, integrado a um backend BaaS.

* **Core:** React 19 + TypeScript + Vite
* **State Management:** Zustand
* **Estilização:** Tailwind CSS v4 + DaisyUI + Ant Design Icons
* **Backend & Auth:** Supabase
* **Roteamento:** React Router v7

## 🧪 Estratégia de Qualidade (QA & Testing)

A aplicação conta com uma esteira robusta de testes e automação, garantindo que as regras complexas de negócio (conversão de unidades e lógicas de filtragem) não sofram regressão.

* **Testes Unitários / Componentes:** Vitest + Testing Library (`@testing-library/react`).
* **Testes E2E (End-to-End):** Playwright com suporte a ambientes remotos e relatórios detalhados.
* **Linting & Padronização:** ESLint (v9) + Semantic Release para versionamento semântico automatizado.

## 🚀 Como Executar o Projeto

### Pré-requisitos
* Node.js (v24+)
* Gerenciador de pacotes (npm/yarn/pnpm)
* Instância/Projeto configurado no Supabase
* Supabase CLI (recomendado para aplicar migrations)

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/ApenasGabs/meuestoque.git
cd meuestoque

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente (.env)
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
cp .env.example .env

# 4. Aplique as migrations no seu projeto Supabase
supabase link --project-ref <seu-ref>
supabase db push

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

Guia completo de setup (incluindo banco local via Docker e validações pós-deploy) em [`docs/SETUP.md`](./docs/SETUP.md).

### Documentação

- [Visão de produto](./docs/FEATURES.md)
- [Arquitetura e dados](./docs/ai/01_ARCHITECTURE_AND_DATA.md)
- [Contratos de RPC](./docs/ai/04_RPC_CONTRACTS.md)
- [Glossário](./docs/GLOSSARY.md)
- [Decisões arquiteturais (ADR)](./docs/adr/)

### Scripts de Desenvolvimento

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia a aplicação localmente via Vite. |
| `npm run build` | Checa a tipagem via TS e gera o bundle de produção. |
| `npm run lint:fix` | Roda o ESLint e corrige automaticamente os problemas encontrados. |
| `npm run preview` | Inicia um servidor local com a versão de build gerada. |

### Scripts de Teste (QA Automation)

**Testes de Unidade:**
```bash
npm run test           # Roda o Vitest em modo watch
npm run test:ui        # Roda o Vitest com interface gráfica
npm run test:coverage  # Gera relatório de cobertura de código
```

**Testes End-to-End (Playwright):**
*O projeto possui scripts customizados de bash (`scripts/run-e2e.sh`) para automação de testes complexos.*

```bash
npm run e2e:install    # Instala os binários dos browsers (Chromium)
npm run e2e            # Roda a suíte completa de testes E2E
npm run e2e:ui         # Roda a suíte com a interface do Playwright
npm run e2e:remote     # Executa os testes apontando para ambiente remoto
```
> Existem atalhos específicos de E2E configurados para testar fluxos isolados como autenticação (`e2e:remote:login`), responsividade (`e2e:theme:tablet`) e validação de falhas (`e2e:remote:failshot`).

## 🏗️ Versionamento e Deploy
Este repositório utiliza **Semantic Release**. Commits devem seguir o padrão *Conventional Commits* (ex: `feat:`, `fix:`, `chore:`) para automatizar a geração do `CHANGELOG.md` e o bump da versão do sistema.


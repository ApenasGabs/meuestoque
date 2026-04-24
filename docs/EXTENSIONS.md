# Extensões Recomendadas do VS Code

Este documento lista todas as extensões necessárias para melhor desenvolvimento com este Meu Estoque.

## 📋 Extensões Obrigatórias

Essas extensões são **necessárias** para que o projeto funcione corretamente com linting, formatação e suporte a linguagens.

| Extensão | ID | Descrição |
|----------|-----|-----------|
| **ESLint** | `dbaeumer.vscode-eslint` | Linting e análise de código em tempo real |
| **Prettier** | `esbenp.prettier-vscode` | Formatação automática de código |
| **Tailwind CSS IntelliSense** | `bradlc.vscode-tailwindcss` | Autocomplete e preview de classes Tailwind CSS |

## 🎁 Extensões Recomendadas

Essas extensões **facilitam muito** o desenvolvimento e são altamente recomendadas.

| Extensão | ID | Descrição |
|----------|-----|-----------|
| **ES7+ React/Redux/React-Native snippets** | `dsznajder.es7-react-js-snippets` | Snippets produtivos para React e TypeScript |
| **Vitest** | `vitest.explorer` | Explorer para executar e debugar testes unitários |
| **Playwright Test for VSCode** | `ms-playwright.playwright` | Debug interativo e execução de testes E2E |
| **GitHub Copilot** | `GitHub.copilot` | Assistência com IA para escrita de código (pago) |
| **GitLens** | `eamodio.gitlens` | Análise de Git integrada e blame |

## 🚀 Instalação Automática

### Via Script Node.js (Recomendado)

```bash
node scripts/install-extensions.js
```

O script irá:
- ✅ Ler a lista de extensões
- ✅ Verificar quais você já tem instaladas
- ✅ Instalar automaticamente as que faltam
- ✅ Mostrar um relatório ao final

### Instalação Manual

Se preferir instalar manualmente, execute no terminal:

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension dsznajder.es7-react-js-snippets
code --install-extension vitest.explorer
code --install-extension ms-playwright.playwright
code --install-extension eamodio.gitlens
```

### Instalação via Marketplace

1. Abra VS Code
2. Vá em **Extensions** (`Ctrl+Shift+X` ou `Cmd+Shift+X`)
3. Procure por cada extensão e instale

## ⚙️ Configuração Automática

Após instalar as extensões, o VS Code carregará automaticamente:

- ✅ `.editorconfig` — Padronização de indentação e line endings
- ✅ `.vscode/settings.json` — Configurações do editor (Prettier, ESLint, Tailwind)
- ✅ ESLint → Validação de código em tempo real
- ✅ Prettier → Formatação automática ao salvar

## 🔧 Verificar Extensões Instaladas

```bash
# Listar todas as extensões instaladas
code --list-extensions

# Listar com versão
code --list-extensions --show-versions
```

## 💡 Dicas

### Prettier + ESLint
Ambos trabalham juntos:
- **ESLint** encontra problemas de código
- **Prettier** formata automaticamente

O `.vscode/settings.json` já está configurado para isso funcionar ao salvar.

### Tailwind CSS IntelliSense
- Oferece autocomplete para classes Tailwind
- Mostra preview de cores ao passar mouse
- Valida classes inválidas

### Vitest + Playwright
- **Vitest** para testes unitários rápidos
- **Playwright** para testes end-to-end em múltiplos navegadores

## 📝 Personalizações

Se quiser adicionar mais extensões ao projeto:

1. Edite `extensions.json` na raiz
2. Adicione a extensão no array apropriado
3. O script detectará e instalará automaticamente

## Suporte

- [Documentação do VS Code Extensions](https://code.visualstudio.com/docs/editor/extension-marketplace)
- [ESLint no VS Code](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier no VS Code](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

# 🚀 Apenas Template - React + TypeScript + Vite + Tailwind CSS + daisyUI

Um template moderno, produtivo e completo para iniciar seus projetos React com tecnologias de ponta. Configurado com TypeScript, Vite, Tailwind CSS, daisyUI, testes e ferramentas de qualidade de código.

> **Feito com muito ❤️ e preguiça de fazer tudo do zero**

## 🎯 Objetivos

Este template tem como objetivo fornecer uma base sólida e pronta para produção para projetos React, eliminando a necessidade de configurar manualmente:

- ✅ Ambiente de desenvolvimento rápido e reativo (HMR instantâneo)
- ✅ Tipagem estática completa com TypeScript
- ✅ Styling elegante com Tailwind CSS + daisyUI
- ✅ Testes unitários com Vitest
- ✅ Testes end-to-end com Playwright
- ✅ Linting e formatação de código com ESLint
- ✅ Build otimizado para produção
- ✅ Estrutura de projeto bem organizada e escalável

## 🛠️ Tecnologias Utilizadas

### Frontend

- **React 19.2.0** - Biblioteca JavaScript para UI reativa
- **TypeScript 5.9.3** - Tipagem estática e segurança de tipos
- **Vite 7.2.4** - Build tool ultra-rápido com HMR
- **Tailwind CSS 4.1.18** - Framework CSS utility-first
- **daisyUI 5.5.14** - Componentes elegantes para Tailwind

### Ferramentas de Desenvolvimento

- **Vitest 4.0.18** - Framework de testes unitários
- **Playwright 1.58.0** - Testes end-to-end em múltiplos navegadores
- **ESLint 9.39.1** - Linting e análise de código
- **PostCSS 8.5.6** - Transformações CSS automatizadas

## 📦 Como Começar

### Pré-requisitos

- Node.js 16+ instalado
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/ApenasGabs/apenasTemplate.git

# Entre na pasta do projeto
cd apenasTemplate

# Instale as dependências
npm install
```

### Desenvolvimento

```bash
# Inicia o servidor de desenvolvimento (porta 5173)
npm run dev
```

O navegador abrirá automaticamente em `http://localhost:5173` com HMR habilitado.

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento

# Build
npm run build            # Cria build otimizado para produção
npm run preview          # Visualiza o build localmente

# Testes
npm run test             # Executa testes unitários com Vitest
npm run test:ui          # Interface visual dos testes
npm run test:coverage    # Relatório de cobertura de testes

# Testes E2E
npm run e2e              # Executa testes Playwright
npm run e2e:ui           # Interface visual dos testes E2E
npm run e2e:debug        # Modo debug dos testes
npm run e2e:report       # Visualiza o relatório HTML

# Linting
npm run lint             # Verifica qualidade do código
npm run lint:fix         # Corrige problemas automaticamente
```

## 📂 Estrutura do Projeto

```
apenasTemplate/
├── e2e/                          # Testes end-to-end
│   ├── app.spec.ts              # Testes da página
│   ├── counter.spec.ts          # Testes do contador
│   ├── features.spec.ts         # Testes das features
│   ├── advanced.spec.ts         # Testes avançados
│   └── README.md                # Documentação E2E
│
├── src/
│   ├── __tests__/               # Testes unitários
│   │   └── example.test.ts
│   ├── assets/                  # Imagens, fontes, etc.
│   ├── App.tsx                  # Componente principal
│   ├── main.tsx                 # Ponto de entrada
│   └── index.css                # Estilos globais
│
├── public/                       # Arquivos estáticos
├── playwright.config.ts         # Configuração Playwright
├── tailwind.config.js           # Configuração Tailwind CSS
├── tsconfig.json                # Configuração TypeScript
├── vite.config.ts               # Configuração Vite
└── eslint.config.js             # Configuração ESLint
```

## 🎨 Recursos Principais

### Tailwind CSS + daisyUI

Componentes elegantes e prontos para uso:

- Navbar responsiva
- Cards estilizados com links
- Botões e badges
- Alerts informativos
- Grid responsivo
- Temas pré-configurados (light, dark, cupcake)

### TypeScript

Tipagem completa em todo o projeto para maior segurança e melhor experiência de desenvolvimento.

### Hot Module Replacement (HMR)

Alterações no código são refletidas instantaneamente sem perder o estado da aplicação.

### Testes Completos

- **Vitest**: Testes unitários rápidos e confiáveis
- **Playwright**: Testes end-to-end em navegadores reais (Chrome, Firefox, Safari, Mobile)

## 🚀 Como Usar Este Template

### 1. Clonar ou usar como template

```bash
# Via GitHub (use o botão "Use this template")
# ou clone normalmente
git clone https://github.com/ApenasGabs/apenasTemplate.git
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Iniciar desenvolvimento

```bash
npm run dev
```

### 4. Personalizar

- Edite `src/App.tsx` para suas necessidades
- Customize cores em `tailwind.config.js`
- Adicione componentes em `src/`
- Adicione testes em `src/__tests__/` e `e2e/`

### 5. Build para produção

```bash
npm run build
npm run preview  # Testar o build localmente
```

## 🔧 Personalizações Recomendadas

### Adicionar novos temas daisyUI

Edite `tailwind.config.js`:

```javascript
daisyui: {
  themes: ["light", "dark", "cupcake", "bumblebee"],
}
```

### Estender Tailwind Theme

Adicione em `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: '#your-color',
    },
  },
}
```

### Adicionar variáveis de ambiente

Crie `.env` e `.env.local`:

```
VITE_API_URL=https://api.example.com
```

Acesse em seus componentes:

```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## 📚 Documentação e Recursos

- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [daisyUI](https://daisyui.com)
- [Vitest](https://vitest.dev)
- [Playwright](https://playwright.dev)
- [ESLint](https://eslint.org)

## 📄 Licença

Este projeto está sob a licença MIT.

---

**Desenvolvido por [@apenasgabs](https://github.com/apenasgabs)**

Feito com muito ❤️ e preguiça de fazer tudo do zero

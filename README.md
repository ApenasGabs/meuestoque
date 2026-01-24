# Apenas Template - React + TypeScript + Vite + Tailwind CSS + daisyUI

Template moderno e completo para projetos React com TypeScript, configurado com Vite, Tailwind CSS, daisyUI e PostCSS.

## 🚀 Tecnologias Incluídas

- **React 19** - Biblioteca JavaScript para construir interfaces
- **TypeScript** - Superset JavaScript com tipagem estática
- **Vite** - Build tool de próxima geração com HMR instantâneo
- **Tailwind CSS** - Framework CSS utility-first
- **daisyUI** - Biblioteca de componentes para Tailwind CSS
- **PostCSS** - Ferramenta para transformar CSS com JavaScript
- **ESLint** - Linter para manter a qualidade do código

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/ApenasGabs/apenasTemplate.git

# Entre na pasta do projeto
cd apenasTemplate

# Instale as dependências
npm install
```

## 🛠️ Scripts Disponíveis

```bash
# Inicia o servidor de desenvolvimento
npm run dev

# Cria o build de produção
npm run build

# Visualiza o build de produção localmente
npm run preview

# Executa o linter
npm run lint
```

## 🎨 Estrutura do Projeto

```
apenasTemplate/
├── public/              # Arquivos estáticos
├── src/
│   ├── assets/         # Imagens, fontes, etc.
│   ├── App.tsx         # Componente principal
│   ├── main.tsx        # Ponto de entrada da aplicação
│   └── index.css       # Estilos globais com Tailwind
├── index.html          # Template HTML
├── tailwind.config.js  # Configuração do Tailwind CSS
├── postcss.config.js   # Configuração do PostCSS
├── tsconfig.json       # Configuração do TypeScript
└── vite.config.ts      # Configuração do Vite
```

## 🎯 Características

### Tailwind CSS
O Tailwind CSS está totalmente configurado e pronto para uso. Utilize as classes utilitárias diretamente nos seus componentes.

### daisyUI
Componentes prontos para uso do daisyUI estão disponíveis. O template inclui três temas pré-configurados:
- light
- dark
- cupcake

### TypeScript
Tipagem completa em todo o projeto, garantindo segurança e melhor experiência de desenvolvimento.

### Hot Module Replacement (HMR)
Alterações no código são refletidas instantaneamente no navegador sem perder o estado da aplicação.

## 📝 Exemplo de Uso

O arquivo `src/App.tsx` contém exemplos de uso do Tailwind CSS e daisyUI, incluindo:
- Navbar responsiva
- Cards estilizados
- Botões e badges
- Alerts informativos
- Grid responsivo

## 🔧 Personalizações

### Adicionar novos temas do daisyUI
Edite `tailwind.config.js`:

```javascript
daisyui: {
  themes: ["light", "dark", "cupcake", "bumblebee", "emerald"],
}
```

### Estender o tema do Tailwind
Adicione customizações em `tailwind.config.js` na seção `theme.extend`.

## 📚 Recursos e Documentação

- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [daisyUI](https://daisyui.com)

## 📄 Licença

Este projeto está sob a licença MIT.

---

Desenvolvido com ❤️ usando React, TypeScript, Vite, Tailwind CSS e daisyUI

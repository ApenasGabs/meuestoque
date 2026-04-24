# 🧩 03: Componentes e UI (daisyUI + Tailwind)

A aplicação foi construída sobre TailwindCSS e daisyUI, mas possui uma camada estendida de componentes reutilizáveis base altamente tipados e acessíveis em `src/components/`.

## Princípio Geral (Ordem de Resolução OBRIGATÓRIA)
1. **Sempre use** um componente interno de `src/components/` se ele existir e for adequado.
2. Se não existir o interno, procure construir algo combinando as classes nativas do **daisyUI** (ex: `btn btn-primary`).
3. Customizar elementos "do zero" (`div className="bg-red-500 rounded p-4"`) é o **ÚLTIMO RECURSO**.

## Componentes Disponíveis (Resumo Rápido)

- **Ações e Inputs**: 
  - `Button` (Suporta estados, ícones e loading), 
  - `Input` e `Textarea` (com suporte a labels e states de error/helperText), 
  - `Checkbox` e `Radio` (Coloridos e agrupáveis).
- **Tipografia e Tags**: 
  - `Badge` (para tags, com variantes de status), 
  - `Label` (semântico).
- **Feedback Visual**: 
  - `Alert` (success, info, warning, error com ícones automáticos), 
  - `Loading` (spinners ou skeleton), 
  - `Progress`.
- **Layout**: 
  - `Card`, `CardBody`, `CardTitle`
  - `Divider`
  - `Navbar`, `Footer`

## Acessibilidade (A11y)
Quase todos os componentes acima foram projetados pensando em A11y:
- Passam o `role` adequado (ex: `role="alert"` em Alerts).
- Asseguram que `aria-label` funcione quando passados como `props`.

## Tipagem (TypeScript Strict)
Ao adicionar novos componentes, crie sempre uma interface clara (evite espalhar tipos mistos no `FC`).
Use a tipagem nativa estendida quando estiver montando "Wrappers" (ex: `interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`).

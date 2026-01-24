# GitHub Copilot - Instruções de Código

## Tipagem TypeScript

- ❌ **NUNCA** usar `any` em nenhuma circunstância
- ✅ Tipar explicitamente todos os parâmetros, retornos e variáveis
- ✅ Usar `unknown` em vez de `any` para tipos desconhecidos
- ✅ Criar interfaces para objetos complexos
- ✅ Usar tipos utilitários do TypeScript quando apropriado
- ✅ **SEMPRE** usar arrow functions, nunca `function` tradicional

```typescript
// ✅ CORRETO - Arrow function
const getUser = (id: string): Promise<User> => {
  // implementação
};

// ❌ NUNCA FAZER - function tradicional
function getUser(id: string): Promise<User> {}

// ❌ NUNCA FAZER - any
const getUser = (id: any): Promise<any> => {};
```

## Segurança - SEMPRE ALERTAR

### Vulnerabilidades a Reportar:

1. **XSS** - `innerHTML` com dados do usuário
2. **Credenciais** - API keys ou secrets no código
3. **Injeção SQL** - queries sem sanitização
4. **Validação** - input sem validação
5. **Exposição de dados** - stack traces para usuário

```typescript
// ❌ VULNERÁVEL - ALERTAR!
element.innerHTML = userInput;
const API_KEY = "sk_123...";

// ✅ SEGURO
element.textContent = userInput;
const API_KEY = import.meta.env.VITE_API_KEY;
```

## Código Limpo

- ✅ Nomes descritivos e claros
- ✅ Funções pequenas com responsabilidade única
- ✅ Evitar código duplicado (DRY)
- ✅ **SEMPRE** usar arrow functions (`const fn = () => {}`)
- ❌ **NUNCA** usar `function` tradicional
- ❌ **NUNCA** criar gambiarras sem explicar
- ❌ Se solução temporária for necessária: explicar, adicionar TODO, propor solução definitiva

```typescript
// ❌ Gambiarra sem explicação
setTimeout(() => element.click(), 100);

// ✅ Solução com contexto
// TODO: Implementar MutationObserver quando disponível
// TEMPORÁRIO: Aguarda elemento estar pronto no DOM
await waitForElement(selector, { timeout: 5000 });
element.click();
```

## Testes - OBRIGATÓRIO

### Antes de finalizar SEMPRE:

```bash
npm run lint        # Verificar erros
npm test            # Testes unitários
npm run e2e         # Testes E2E
npm run build       # Build de produção
```

### Padrões de Teste:

- ✅ Usar `data-testid` para seletores
- ✅ Cobrir casos extremos (edge cases)
- ✅ Testar comportamento, não implementação
- ✅ Testes unitários: `.test.tsx`
- ✅ Testes E2E: `.spec.ts`

```typescript
// ✅ BOM
it('deve desabilitar botão quando loading', () => {
  render(<Button loading data-testid="btn" />);
  expect(screen.getByTestId('btn')).toBeDisabled();
});
```

## React - Boas Práticas

```typescript
// ✅ Componente tipado
import type { ReactElement, ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false
}: ButtonProps): ReactElement => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
      data-testid="button"
      aria-label="Button action"
    >
      {children}
    </button>
  );
};
```

### Importações de Tipos

````typescript
// ✅ CORRETO - Importar tipos diretos
import type { ReactElement, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
}

export const Component = ({ children, onClick }: Props): ReactElement => {
  // implementação
};

// ❌ EVITAR - Usar namespace desnecessário
export const Component = ({ children, onClick }: Props): React.ReactElement => {
  // implementação
};

// ❌ EVITAR - Importar React sem necessidade
import React from "react";
export const Component = (): React.ReactElement => {
  // implementação
};
- ✅ `aria-label` em elementos interativos sem texto
- ✅ `alt` text em imagens
- ✅ Navegação por teclado funcional
- ✅ `data-testid` para testes

```typescript
// ✅ Acessível
<button aria-label="Fechar" data-testid="close-btn">
  <XIcon />
</button>

// ❌ Não acessível
<div onClick={handleClose}>
  <XIcon />
</div>
````

## daisyUI Components - PRIORIZAR

**ORDEM OBRIGATÓRIA**:

1. Reutilizar componentes internos já existentes no projeto.
2. Se não houver componente interno adequado, usar componente daisyUI equivalente.
3. Só criar componente customizado se não existir solução interna nem daisyUI.

**SEMPRE** usar componentes daisyUI quando disponíveis. Evitar criar componentes customizados que já existem na biblioteca.

### Componentes Disponíveis

- `btn` - Botões em várias variantes
- `card` - Containers com estilos
- `badge` - Badges/labels
- `alert` - Mensagens de alerta
- `dropdown` - Menus dropdown
- `menu` - Menus estruturados
- `navbar` - Barras de navegação
- `footer` - Rodapés
- `input` - Campos de entrada
- `select` - Selectors
- `checkbox` - Checkboxes
- `radio` - Radio buttons
- `tabs` - Abas
- `modal` - Modais/dialogs
- `toast` - Notificações
- `spinner` - Loading spinners
- `skeleton` - Loading placeholders
- `progress` - Barras de progresso

Consultar [daisyUI Documentation](https://daisyui.com/) para todos os componentes disponíveis.

```typescript
// ✅ USAR DAISYUI
import type { ReactElement, ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
}

export const MyButton = ({ children, onClick }: ButtonProps): ReactElement => {
  return (
    <button
      className="btn btn-primary"
      onClick={onClick}
      data-testid="my-button"
    >
      {children}
    </button>
  );
};

// ❌ NÃO FAZER - Criar custom quando daisyUI tem solução
export const MyButton = ({ children, onClick }: ButtonProps): ReactElement => {
  return (
    <div
      className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"
      onClick={onClick}
    >
      {children}
    </div>
  );
};
```

## Performance

- ✅ `React.memo` para componentes pesados
- ✅ `useCallback` para funções passadas como props
- ✅ `useMemo` para cálculos caros
- ✅ Lazy loading de rotas
- ✅ Debounce em inputs de busca

## Documentação

### JSDoc - OBRIGATÓRIO

- ✅ **APENAS** usar JSDoc para documentar funções públicas
- ✅ Ser sucinto - descrever O QUE a função faz
- ✅ Documentar parâmetros, retorno e exceções
- ✅ Adicionar `@example` se não óbvio
- ❌ **NUNCA** comentários aleatórios no código
- ❌ **NUNCA** comentar o óbvio

```typescript
// ✅ CORRETO - JSDoc claro e sucinto
/**
 * Calcula preço total incluindo descontos
 *
 * @param items - Itens do carrinho
 * @param discount - Código de desconto opcional
 * @returns Preço formatado em BRL
 * @throws {Error} Se items está vazio
 */
const calculateTotal = (
  items: CartItem[],
  discount?: string
): string => {
  // implementação
};

// ❌ ERRADO - Comentários aleatórios
const calculateTotal = (
  items: CartItem[],
  discount?: string
): string => {
  // Verifica se items existe
  if (!items) {
    return '0';
  }
  // Reduz itens para total
  return items.reduce(...); // Retorna total
};
```

### Emojis

- ✅ Usar **APENAS** em documentação de guias/manuais
- ✅ Com moderação - máximo 1 por seção
- ❌ **NUNCA** em código fonte
- ❌ **NUNCA** em comentários de código
- ❌ **NUNCA** em commits ou PRs

```typescript
// ❌ ERRADO - Emojis em código
const getUser = (id: string): Promise<User> => {
  // 🔍 Busca o usuário
  const user = db.findById(id); // ✅ Encontrado!
  return user;
};

// ✅ CORRETO - Sem emojis
const getUser = (id: string): Promise<User> => {
  return db.findById(id);
};
```

## Checklist Final

Antes de considerar código finalizado:

- [ ] Zero erros TypeScript
- [ ] Sem uso de `any`
- [ ] Lint passando
- [ ] Testes unitários passando
- [ ] Testes E2E passando
- [ ] Build funcionando
- [ ] Sem vulnerabilidades de segurança
- [ ] Acessibilidade implementada
- [ ] data-testid em elementos interativos

## Padrões de Commits

Seguir o padrão de commits semânticos de: https://github.com/iuricode/padroes-de-commits

**⚠️ REGRA IMPORTANTE:** Após implementar as mudanças, **NUNCA fazer commit diretamente**. Sempre:

1. Mostrar a mensagem de commit proposta
2. Aguardar validação do usuário
3. Perguntar: "Está ok commitar com essa mensagem?"
4. Só fazer commit após aprovação explícita

### Tipos de Commits

| Emoji | Tipo       | Descrição                                     |
| ----- | ---------- | --------------------------------------------- |
| ✨    | `feat`     | Novo recurso (MINOR)                          |
| 🐛    | `fix`      | Correção de bug (PATCH)                       |
| 📚    | `docs`     | Alterações em documentação                    |
| 👌    | `style`    | Formatação, semicolons, trailing spaces, lint |
| ♻️    | `refactor` | Refatoração sem alterar funcionalidade        |
| 🧪    | `test`     | Alterações em testes                          |
| 🔧    | `chore`    | Atualização de dependências, configurações    |
| ⚡    | `perf`     | Melhoria de performance                       |
| 📦    | `build`    | Alterações em build e dependências            |
| 🧱    | `ci`       | Integração contínua                           |
| 🧹    | `cleanup`  | Limpeza de código comentado                   |
| 🗑️    | `remove`   | Remoção de arquivos/funcionalidades           |

### Formato

```
<tipo>: <descrição em imperativo/presente>

[corpo opcional]
```

**⚠️ IMPORTANTE:** Usar sempre verbos no imperativo (presente), descrevendo o que o commit **faz**, não o que **vai fazer** ou **fez**.

Exemplos de uso correto:

- ✅ "cria novo componente" (o commit cria)
- ✅ "arruma validação" (o commit arruma)
- ✅ "adiciona link do GitHub" (o commit adiciona)
- ✅ "remove código comentado" (o commit remove)
- ❌ "criar novo componente" (infinitivo - parece futuro)
- ❌ "arrumar validação" (infinitivo - parece futuro)
- ❌ "adicionar link do GitHub" (infinitivo - parece futuro)

### Exemplos

```bash
# Novo recurso
git commit -m "feat: ✨ adiciona autenticação com Google"

# Correção de bug
git commit -m "fix: 🐛 arruma validação de email no formulário"

# Documentação
git commit -m "docs: 📚 atualiza README com instruções de instalação"

# Refatoração
git commit -m "refactor: ♻️ converte function para arrow function"

# Testes
git commit -m "test: 🧪 adiciona testes unitários para ThemeSelector"

# Limpeza
git commit -m "cleanup: 🧹 remove código comentado e imports não utilizados"

# Dependências
git commit -m "chore: 🔧 atualiza dependências do projeto"

# Performance
git commit -m "perf: ⚡ otimiza renderização do ThemeSelector"

# Build
git commit -m "build: 📦 adiciona eslint-plugin-tailwindcss"
```

## Comunicar Sempre Que:

- Detectar vulnerabilidade de segurança
- Implementar solução temporária (explicar porquê)
- Sugerir instalação de dependência
- Identificar breaking change
- Encontrar bug existente no código

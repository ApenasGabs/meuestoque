# Engineering Standards — Meu Estoque

> These standards are enforced during automated code review (Surmado) and human PR review.
> Source of truth: this file + `.github/copilot-instructions.md`.

## Tech Stack

| Layer          | Technology                                      |
| -------------- | ----------------------------------------------- |
| Framework      | React 19 + Vite 7                               |
| Language       | TypeScript 5.9 (strict)                         |
| Styling        | Tailwind CSS 4 + daisyUI 5                      |
| State          | Zustand 5                                       |
| Routing        | React Router DOM 7                              |
| Backend        | Supabase (Auth, Database, Realtime)             |
| Unit Tests     | Vitest + Testing Library                        |
| E2E Tests      | Playwright                                      |
| CI/CD          | GitHub Actions + Semantic Release + Vercel      |

---

## 1. TypeScript

- **Never** use `any`. Use `unknown` for truly unknown types.
- Explicitly type all parameters, return values, and variables.
- Create `interface` declarations for complex objects.
- Use TypeScript utility types (`Partial`, `Pick`, `Omit`, etc.) when appropriate.
- Use `import type { ... }` for type-only imports.

```typescript
// Correct
import type { ReactElement, ReactNode } from "react";
const getUser = (id: string): Promise<User> => { ... };

// Wrong
const getUser = (id: any): Promise<any> => { ... };
```

---

## 2. Functions & Code Style

- **Always** use arrow functions (`const fn = () => {}`). Never use `function` declarations.
- Use descriptive, clear names.
- Keep functions small with a single responsibility (SRP).
- Follow DRY — avoid code duplication.
- Never commit workarounds without a `// TODO:` comment explaining why and proposing the proper fix.

```typescript
// Correct
const calculateTotal = (items: CartItem[]): number => { ... };

// Wrong
function calculateTotal(items) { ... }
```

---

## 3. React Conventions

- Components must be typed with `ReactElement` return type.
- Props must be defined via an explicit `interface`.
- Do **not** import the default `React` namespace; import named exports directly.
- Use `React.memo` for heavy components, `useCallback` for callback props, `useMemo` for expensive calculations.
- Use lazy loading for route-level code splitting.
- Use debounce on search inputs.

```typescript
import type { ReactElement, ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export const Button = ({ children, onClick, variant = "primary" }: ButtonProps): ReactElement => {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick} data-testid="button" aria-label="Action">
      {children}
    </button>
  );
};
```

---

## 4. UI Components — daisyUI First

Follow this priority order when building UI:

1. **Reuse** an existing internal project component.
2. **Use** a daisyUI component if no internal component exists.
3. **Create** a custom component only as a last resort.

Never hand-craft styles (e.g. `bg-blue-500 rounded`) for elements that daisyUI already provides (`btn`, `card`, `alert`, `modal`, `badge`, etc.).

---

## 5. Accessibility

- All interactive elements without visible text must have `aria-label`.
- All images must have meaningful `alt` text.
- Keyboard navigation must work for all interactive flows.
- All interactive/testable elements must have a unique `data-testid` attribute.
- Never use a `<div>` with `onClick` as a button substitute — use `<button>`.

---

## 6. Security

Flag these patterns during review:

| Vulnerability       | Bad pattern                                   | Expected pattern                              |
| -------------------- | --------------------------------------------- | --------------------------------------------- |
| XSS                 | `element.innerHTML = userInput`               | `element.textContent = userInput`             |
| Hardcoded secrets   | `const API_KEY = "sk_123..."`                 | `import.meta.env.VITE_API_KEY`                |
| SQL Injection       | Unsanitized queries                           | Parameterized queries / Supabase RLS          |
| Missing validation  | Unvalidated user input                        | Input validation before processing            |
| Data exposure       | Stack traces sent to user                     | Generic error messages in production          |

---

## 7. Testing

### Unit Tests (Vitest)

- File naming: `*.test.ts` / `*.test.tsx`
- Use `data-testid` for element selectors.
- Test **behavior**, not implementation details.
- Cover edge cases and error paths.

### E2E Tests (Playwright)

- File naming: `*.spec.ts`
- Use deterministic assertions — never `waitForTimeout`.
- Always clean up test data to prevent leaks between runs.

### Pre-merge checklist

All of the following must pass before a PR is mergeable:

```bash
npm run lint        # Zero lint errors
npm run typecheck   # Zero TypeScript errors
npm test -- --run   # All unit tests pass
npm run e2e         # All E2E tests pass
npm run build       # Production build succeeds
```

---

## 8. Documentation — JSDoc Only

- Document **public functions** with JSDoc (`@param`, `@returns`, `@throws`, `@example`).
- Be concise — describe **what** the function does, not how.
- Never add inline comments that restate what the code already says.
- Never use emojis in source code or code comments.

```typescript
/**
 * Calculates total price including discounts.
 *
 * @param items - Cart items
 * @param discount - Optional discount code
 * @returns Formatted price in BRL
 * @throws {Error} If items is empty
 */
const calculateTotal = (items: CartItem[], discount?: string): string => { ... };
```

---

## 9. Commit Messages

Follow [Conventional Commits](https://github.com/iuricode/padroes-de-commits) with imperative present tense (Portuguese).

**Format:** `<type>: <emoji> <description>`

| Type       | Emoji | Use case                                      |
| ---------- | ----- | --------------------------------------------- |
| `feat`     | ✨    | New feature                                   |
| `fix`      | 🐛    | Bug fix                                       |
| `docs`     | 📚    | Documentation changes                         |
| `style`    | 👌    | Formatting, lint fixes                        |
| `refactor` | ♻️    | Refactor without behavior change              |
| `test`     | 🧪    | Test additions/changes                        |
| `chore`    | 🔧    | Dependency updates, config                    |
| `perf`     | ⚡    | Performance improvement                       |
| `build`    | 📦    | Build system changes                          |
| `ci`       | 🧱    | CI pipeline changes                           |
| `cleanup`  | 🧹    | Dead code removal                             |
| `remove`   | 🗑️    | File/feature removal                          |

**Examples:**

```
feat: ✨ adiciona autenticação com Google
fix: 🐛 arruma validação de email no formulário
refactor: ♻️ converte function para arrow function
```

---

## 10. Git Workflow

- **Branches:** `main` (production), `develop` (integration), `feature/*`, `fix/*`, `docs/*`
- **Never** commit directly to `main` for features — use Pull Requests.
- **Always** `git pull` before committing.
- **Never** merge to `main` manually — use PR + review.

---

## 11. PR Review Checklist

Before approving a PR, reviewers must verify:

- [ ] Zero TypeScript errors (`npm run typecheck`)
- [ ] No `any` usage
- [ ] Lint passes (`npm run lint`)
- [ ] Unit tests pass and cover new behavior
- [ ] E2E tests pass if UI changed
- [ ] Build succeeds (`npm run build`)
- [ ] No security vulnerabilities introduced
- [ ] Accessibility requirements met (`aria-label`, `data-testid`)
- [ ] daisyUI components used where applicable (no hand-rolled equivalents)
- [ ] Arrow functions used exclusively (no `function` declarations)
- [ ] Hook/function names accurately reflect their responsibility
- [ ] JSDoc on new public functions

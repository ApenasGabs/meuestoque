# Testes E2E com Playwright

Este projeto inclui testes end-to-end configurados com **Playwright** em **TypeScript**.

## 📁 Estrutura

```text
e2e/
├── general/              # Testes gerais da aplicação
│   ├── app.spec.ts      # Testes da página principal
│   └── features.spec.ts # Testes dos cards de features
├── components/           # Testes de componentes específicos
│   ├── counter.spec.ts  # Testes do componente contador
│   └── theme-selector.spec.ts # Testes do seletor de temas
└── accessibility/        # Testes de acessibilidade
    └── advanced.spec.ts # Testes avançados de a11y
```

## 🚀 Executando os Testes

### Modo padrão

Execute todos os testes em todos os navegadores:

```bash
npm run e2e
```

### Modo remoto (tablet)

Passo 1: abra o túnel SSH para o tablet em um terminal dedicado:

```bash
pnpm run e2e:tunnel
```

Passo 2: em outro terminal, rode o Playwright já conectado ao Chrome do tablet via **WebSocket CDP** (resolvido a partir de `http://127.0.0.1:LOCAL_TUNNEL_PORT/json/version`):

```bash
pnpm run e2e:remote
pnpm run e2e:remote:theme
pnpm run e2e:remote:login
# equivalente:
pnpm run e2e -- test -remote
pnpm run e2e -- test -remote theme
pnpm run e2e -- test -remote login
```

Com `-remote`, o script `scripts/run-remote-playwright.mjs`:

- valida o túnel CDP e obtém `webSocketDebuggerUrl`
- valida que a app responde em `PLAYWRIGHT_APP_URL` (ou `PLAYWRIGHT_BASE_URL`)
- define `PLAYWRIGHT_CDP_URL` e `PLAYWRIGHT_REMOTE_MODE=1`
- os specs de `e2e/tablet` usam fixture remoto (`e2e/tablet/remote-test.ts`) com `chromium.connectOverCDP`
- o fixture reaproveita o contexto/aba já aberta no Chrome do tablet ("sequestro" da guia atual)
- por padrão executa os testes em `e2e/tablet/` (manifesto `scripts/remote-suites.json`)

Documentação dos fluxos remotos do tablet: [`e2e/tablet/REMOTE_FLOWS.md`](./tablet/REMOTE_FLOWS.md)

Suites nomeados no manifesto: `tablet` (pasta inteira), `theme`, `login`. Listar:

```bash
node scripts/run-remote-playwright.mjs --list-suites
```

Passar argumentos crus do Playwright (sem suite do manifesto):

```bash
pnpm run e2e -- test -remote -- e2e/tablet/login.spec.ts --headed
```

**Login remoto:** defina `E2E_REMOTE_EMAIL` e `E2E_REMOTE_PASSWORD` no `.env.local` (veja `.env.example`). Sem essas variáveis o spec de login é ignorado (`test.skip`).

**Nota:** `pnpm run e2e:ui -- -remote` e `pnpm run e2e:debug -- -remote` não abrem a UI do Playwright no modo CDP remoto descrito acima; use o fluxo `-remote` para o runner Node ou rode Playwright localmente sem `-remote`.

Se o túnel não estiver ativo, o runner falha com instrução para executar `pnpm run e2e:tunnel`.

### Modo UI (recomendado para desenvolvimento)

Interface visual para executar e debugar testes:

```bash
npm run e2e:ui
```

### Modo Debug

Execute testes com o debugger aberto:

```bash
npm run e2e:debug
```

### Ver relatório HTML

Visualize o relatório de teste mais recente:

```bash
npm run e2e:report
```

## 🌐 Navegadores Testados

O Playwright está configurado para testar em:

- **Chromium** (Desktop)
- **Firefox** (Desktop)
- **WebKit** (Safari - Desktop)
- **Mobile Chrome** (Pixel 5)
- **Mobile Safari** (iPhone 12)

## ⚙️ Configuração

O arquivo `playwright.config.ts` contém todas as configurações:

- Base URL: `http://localhost:5173`
- Screenshots apenas em falhas
- Traces gravados na primeira falha
- Servidor dev iniciado automaticamente

## 📝 Escrevendo Novos Testes

### Template básico

```typescript
import { test, expect } from '@playwright/test';

test.describe('Meu teste', () => {
  test('deve fazer algo', async ({ page }) => {
    await page.goto('/');
    
    // Seus assertions aqui
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### Exemplos úteis

```typescript
// Navegar
await page.goto('/');

// Localizar elementos
const button = page.locator('button:has-text("Clique")');

// Interações
await button.click();
await page.fill('input', 'texto');

// Assertions
await expect(button).toBeVisible();
await expect(button).toContainText('Clique');
await expect(page).toHaveURL('/');
```

## 📚 Documentação

- [Documentação oficial Playwright](https://playwright.dev)
- [Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)

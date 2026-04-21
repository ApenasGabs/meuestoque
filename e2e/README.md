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
npm run e2e:tunnel
```

Passo 2: em outro terminal, rode qualquer comando E2E com a flag `-remote`:

```bash
npm run e2e -- -remote
npm run e2e:ui -- -remote
npm run e2e:debug -- -remote
```

Com `-remote`, o runner:

- valida acesso ao CDP local do túnel (`127.0.0.1:LOCAL_TUNNEL_PORT`)
- valida acesso ao endpoint remoto da aplicação (`PLAYWRIGHT_APP_URL`)
- executa o cenário no dispositivo via CDP

Se o túnel não estiver ativo, ele falha com instrução para executar `npm run e2e:tunnel`.

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

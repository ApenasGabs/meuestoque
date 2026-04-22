# Fluxos remotos do tablet

Este arquivo documenta os fluxos E2E executados no Chrome do tablet via CDP.

## Pré-requisitos

1. Abrir o túnel SSH para o tablet.
2. Garantir `PLAYWRIGHT_APP_URL` apontando para a aplicação acessível na rede local.
3. Definir `E2E_REMOTE_EMAIL` e `E2E_REMOTE_PASSWORD` no `.env.local` para os fluxos autenticados.
4. Rodar o runner com `-remote` para usar o contexto/página já abertos no dispositivo.

## Login

Arquivo: [`e2e/tablet/login.spec.ts`](./login.spec.ts)

Passos:
1. Abrir a tela de login em `/login`.
2. Preencher e-mail e senha vindos do ambiente.
3. Clicar em `Entrar`.
4. Validar que a sessão autenticada ficou visível no shell remoto.

Comando:
```bash
pnpm run e2e:remote:login
```

## Tema

Arquivo: [`e2e/tablet/theme-smoke.spec.ts`](./theme-smoke.spec.ts)

Passos:
1. Abrir a aplicação em `/`.
2. Abrir o seletor de temas.
3. Selecionar o tema `Dark`.
4. Validar `data-theme="dark"` e persistência no `localStorage`.
5. Recarregar a página e confirmar que o tema continua ativo.

Comando:
```bash
pnpm run e2e:remote:theme
```

## Sair da conta

Arquivo: [`e2e/tablet/logout.spec.ts`](./logout.spec.ts)

Passos:
1. Entrar com o usuário remoto usando credenciais do ambiente.
2. Abrir a página de perfil em `/profile`.
3. Clicar em `Sair da conta`.
4. Validar o redirecionamento para `/login`.
5. Confirmar que a tela de login voltou a ficar disponível.

Comando:
```bash
pnpm run e2e:remote:logout
```

## Execução direta por arquivo

Qualquer fluxo também pode ser executado diretamente pelo caminho do spec:

```bash
pnpm run e2e -- test -remote -- e2e/tablet/logout.spec.ts --headed
```

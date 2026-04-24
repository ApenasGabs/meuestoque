# Checklist de Implementação: Fusão das UIs (InventoryFeatureApp + ComprasWebShell)

## Objetivo Principal
Criar o "casamento perfeito": **A superioridade em UX e navegação do InventoryFeatureApp (Interface 1) fundida com a robustez, conexão ao Supabase e regras de negócio do ComprasWebShell (Interface 2).** O foco desta mudança é melhorar a **Experiência do Usuário (UX)**, trazendo as funcionalidades reais da aplicação para uma interface amigável, mobile-first e de baixa carga cognitiva.

## Diretrizes de Desenvolvimento
1. **Reaproveitamento de Código:** Os componentes visuais do `InventoryFeatureApp` (chips, cards, botões) devem ser **reutilizados e adaptados** ao máximo para a nova shell, evitando recriar UI do zero.
2. **Progressive Disclosure:** Manter a tela principal limpa. Ações complexas devem ficar ocultas até serem solicitadas (ex: uso do Bottom Sheet).
3. **Feedback Imediato:** Toda ação do usuário (adicionar, remover, editar) deve ter um feedback visual claro e rápido (Toasts, mudança de cor).
4. crie novos componentes caso haja necessidade, para nao ter componentes gigantes demais

## Como Usar Este Documento
- Este checklist deve ser atualizado a cada implementação/modificação.
- Marcar itens concluídos com `[x]`.
- Registrar evidências no "Log de Progresso" (arquivos alterados, testes executados, observações).
- Em caso de bloqueio, registrar no "Riscos e Bloqueios" com próximo passo.

---

## Fase 0 - Baseline e Segurança de Mudança
- [ ] Confirmar baseline atual da aplicação (fluxos de login, grupo, lista, estoque, perfil).
- [x] Validar que a shell ativa continua sendo a conectada ao banco.
- [x] Garantir seletores estáveis para testes (`data-testid`) nas áreas que serão mexidas.
- [ ] Documentar métricas iniciais de regressão (navegação, realtime, importação, finalização).

### Critérios de aceite
- [ ] Fluxos principais mapeados e reproduzíveis.
- [ ] Nenhuma alteração funcional antes da Fase 1.

---

## Fase 1 - Casca de Navegação Mobile no Shell Conectado
- [x] Migrar navegação privada principal para formato mobile-first (Bottom Navigation fixa).
- [x] Mapear abas principais para rotas reais (`/stock`, `/list`, `/profile`).
- [x] Manter compatibilidade com logout e contexto de usuário/grupo.
- [x] Preservar guards existentes sem alterar regra de acesso.
- [x] **[UX Extra]** Garantir que a aba ativa na Bottom Navigation tenha contraste claro (cor primária) e indicadores numéricos (badges) visíveis.

### Critérios de aceite
- [x] Navegação principal funciona em mobile e desktop (com menu na parte inferior/lateral dependendo da tela).
- [ ] Guards continuam bloqueando/acessando corretamente.

---

## Fase 2 - Reestruturação da Tela de Estoque (A "Cara" da Interface 1)
- [x] Aplicar cabeçalho compacto com resumo dinâmico de status (baixo/zerado).
- [x] Implementar filtros rápidos com **chips horizontais deslizáveis** (Todos, Somente na lista, Categorias).
- [x] Refatorar card de produto para o "caminho feliz":
  - [x] Área informativa (esquerda) assumindo o papel de gatilho clicável para o Bottom Sheet.
  - [x] Indicador visual de expansão (ícone de `chevron-right` ou três pontos).
  - [x] Controles rápidos (direita): `[-]`, `[Qtd]`, `[+]`, `[Add Lista]`.
- [x] **[Novo]** Aplicar `Debounce` na barra de busca para não sobrecarregar as chamadas ao Supabase.
- [x] **[Novo]** Substituir *Spinners* de carregamento por **Skeleton Loading** ao buscar/filtrar itens, mantendo a percepção de performance.
- [x] **[Novo]** Implementar **Empty States** ilustrados caso a busca ou filtro não retorne resultados.

### Critérios de aceite
- [ ] Tela visualmente idêntica ao conceito do `InventoryFeatureApp`.
- [ ] Filtros e busca respondem rapidamente com dados do Supabase.

---

## Fase 3 - Progressive Disclosure com Bottom Sheet (Novo Padrão UX)
- [x] Introduzir componente de Bottom Sheet deslizando da parte inferior ao clicar no card do item.
- [x] Mover para o Bottom Sheet as ações de gestão pesada:
  - [x] Editar item
  - [x] Ajustar mínimo
  - [x] Histórico/consumo (com visualização clara de dados)
  - [x] Remoção destrutiva
- [x] Configurar remoção destrutiva com confirmação em duas etapas (botão vermelho isolado no final do painel).
- [x] **[Novo]** Adicionar fechamento do Bottom Sheet ao clicar fora dele (Backdrop tap) ou deslizar para baixo (Swipe down).

### Critérios de aceite
- [x] Lista principal livre de poluição visual.
- [ ] Bottom Sheet fluido, sem travamentos ao carregar dados complementares.

---

## Fase 4 - Reestruturação da Tela de Lista
- [x] Aplicar padrão visual consistente com o novo Estoque.
- [x] Usar chips horizontais para filtros/categorias na lista.
- [x] Melhorar legibilidade de itens, quantidade e preço sem perder densidade útil.
- [x] **[Novo]** Adicionar feedback rápido (Toast notification) sem interromper a navegação ao: adicionar do estoque, marcar como comprado, remover.
- [ ] Preservar fluxo de finalizar compra e atualização em tempo real via Supabase.

### Critérios de aceite
- [ ] Fluxo de compra fluido, operável com uma mão só em mobile.
- [ ] Toasts aparecem e somem corretamente sem sobrepor botões de ação.

---

## Fase 5 - Configurações, Preferências e Consistência Visual
- [x] Manter ThemeSelector e preferência de fonte funcionando.
- [x] Garantir aplicação de tema via `data-theme` em html/body.
- [x] Consolidar estilos compartilhados (tipografia, cores de alerta laranja/vermelho, border-radius) entre páginas novas.
- [x] Evitar conflito de classes globais legadas com o layout novo.

---

## Fase 6 - Corte da UI Duplicada e Limpeza Técnica
- [x] Remover alternância entre UI antiga e UI conectada no ponto de entrada (`App.tsx`).
- [ ] Eliminar componentes e arquivos CSS obsoletos da Interface 2 antiga após migração completa.
- [ ] Atualizar documentação técnica apontando para a nova arquitetura unificada.

---

## Testes Obrigatórios por Fase
- [ ] `npm run lint` (falhou por issues preexistentes fora do escopo desta entrega)
- [x] `npm test`
- [ ] `npm run e2e` (timeout do webServer no ambiente atual)
- [x] `npm run build`

## Suíte de Regressão Prioritária
- [ ] Login e logout
- [ ] Guard de autenticação e de grupo
- [ ] Navegação entre rotas principais
- [ ] Realtime de estoque e da lista (Supabase)
- [ ] Finalizar compra sem erros de cálculo

---

## Log de Progresso

### 2026-04-22
- Revisão UI/UX do shell conectado concluída (rotas privadas com guards preservados em `RequireAuth` e `RequireGroup`).
- Navegação mobile melhorada com contraste de aba ativa + indicador visual superior + badges numéricos em `src/ComprasWebShell.tsx`.
- Estoque atualizado com debounce de busca, skeletons para carregamento/filtro, empty state ilustrado e feedback por toast em `src/pages/StockPage.tsx`.
- Bottom Sheet com fechamento por swipe down adicionado em `src/pages/StockPage.tsx`.
- Lista ajustada para exibir toast sem competir com navegação inferior (reposicionado para topo) em `src/pages/ListPage.tsx`.
- Estilos globais legados reduzidos para evitar conflitos com daisyUI (`label:not(.label)`) e tokens do tema aplicados no `:root` em `src/index.css`.
- Seletores `data-testid` adicionados/ajustados: `stock-search-input`, `stock-empty-state`, `stock-loading-skeleton`, `stock-feedback-toast`, `list-feedback-toast`.

### Testes executados
- `npm run lint`: falhou por erros preexistentes em arquivos não alterados no escopo desta implementação (ex.: `e2e/tablet/remote-test.ts`, `src/components/AddItemModal.tsx`, `src/components/StockItemModal.tsx`, `src/pages/HistoryPage.tsx` e equivalentes em `v0/`).
- `npm test`: passou (77 testes).
- `npm run build`: passou.
- `npm run e2e`: falhou por timeout no `config.webServer` (ambiente de execução).

## Riscos e Bloqueios
- O lint global está bloqueado por regras/arquivos fora deste escopo de UX/UI.
- A suíte E2E não iniciou no ambiente atual por timeout do servidor Playwright.

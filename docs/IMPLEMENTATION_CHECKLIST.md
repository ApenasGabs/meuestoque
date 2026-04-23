# Checklist de Implementação Gradual

Documento de apoio para evoluir a aplicação sem perder o contexto. A ordem abaixo está priorizada por impacto no uso real e por viabilidade de entrega incremental.

## Leitura rápida

- A app agora está em `src/ComprasWebShell.tsx` com autenticação via Supabase e dados persistentes
- Novos componentes UI estão em `src/features/inventory/` com a nova UX (chips, smart input, validity pending)
- Integração: `useInventoryFeatureWeb` faz bridge entre nova UI e dados do Supabase via `useStockStore`
- Novas páginas: `StockPageNew` e `ListPageNew` usam os componentes novo com dados reais do Supabase
- Estrutura legada em `src/pages/StockPage.tsx` e `src/pages/ListPage.tsx` ainda existe mas não está em uso

## Prioridade de entrega

### 0. Integração com Supabase ✅ CONCLUÍDO

- [x] Criar `useInventoryFeatureWeb` como bridge entre UI nova e `useStockStore` (Supabase)
- [x] Mapear `StockItemRecord` → `InventoryProduct` para compatibilidade
- [x] Integrar ShoppingListView e StockView em `StockPageNew` e `ListPageNew`
- [x] Conectar ComprasWebShell para usar novas páginas
- [x] Manter autenticação e contexto de grupo funcionando

Observações:

- Agora toda a nova UX funciona com dados do Supabase (persistência real)
- Usuários fazem login/register e os dados salvam automaticamente
- Categorias são extraídas dinamicamente dos itens
- Validação, filtros e smart input agora trabalham com dados reais
- Migração de estado local para Supabase foi transparente aos componentes

### 1. Pendentes de validade no topo

- [x] Marcar itens recém-comprados ou próximos do vencimento com tag `Pendente Validade`.
- [x] Fixar esses itens no topo da lista, acima de qualquer outra ordenação.
- [x] Garantir que essa regra ignore filtros ativos para não esconder alertas.
- [x] Abrir modal rápido para informar data de validade e remover a tag ao salvar.

Observações:

- Impacto alto e fácil de perceber pelo usuário.
- Tem boa chance de reaproveitar a lógica legada de validade e lotes.
- Depende de um campo de validade por item ou por lote.

### 2. Filtros por chips sticky com múltipla seleção

- [x] Substituir o select atual por chips horizontais.
- [x] Manter a barra de filtros e o contador fixos no topo durante o scroll.
- [x] Permitir múltiplos filtros ao mesmo tempo.
- [x] Exibir o estoque completo quando nenhum filtro estiver ativo.

Observações:

- É uma melhoria de navegação com baixo risco funcional.
- Pode ser entregue antes da modelagem completa da validade.
- Deve respeitar a ordenação prioritária dos itens pendentes.

### 3. Edição principal em bottom sheet

- [x] Tornar o card do produto clicável para abrir a edição completa.
- [x] Separar ações rápidas da listagem principal.
- [x] Remover controles de `+` e `-` da listagem para evitar toques acidentais.
- [x] Manter a edição detalhada em um modal/bottom sheet consistente.

Observações:

- Isso muda bastante a ergonomia da tela principal.
- É viável como refatoração de UI sem alterar o domínio ainda.
- Pode ser feito antes da unidade composta e do histórico financeiro.

### 4. Input inteligente da lista

- [x] Aceitar entrada no formato `Nome, quantidade, valor`.
- [x] Destacar em tempo real o que foi interpretado pelo parser.
- [x] Criar itens sem categoria como `Outros` por padrão.
- [x] Sugerir unidade quando o parser encontrar quantidade numérica.

Observações:

- O parser já existe em partes na base e pode ser evoluído.
- É um dos itens de maior ganho de produtividade na rotina.
- Exige boa cobertura de testes para não degradar o fluxo de digitação.

### 5. Consolidação do modelo de dados

- [x] Criar `useInventoryFeatureWeb` como adapter entre tipo novo e Supabase
- [ ] Implementar full sync entre StockItemRecord e InventoryProduct para todas as operações
- [ ] Adicionar campos de batch/lote ao modelo para rastrear grupos de compra
- [ ] Definir estratégia de versionamento para histórico de movimentações
- [ ] Criar migration path para dados legados (EstoquePage, ListaPage)

Observações:

- Esse passo destrava os itens mais complexos.
- Sem isso, as próximas entregas tendem a virar patches sobre patches.
- É o principal ponto de viabilidade arquitetural do documento.
- `useInventoryFeatureWeb` já faz o mapeamento básico, mas faltam campos de lote e histórico
- A consolidação completa com a camada legada ainda precisa ser decidida antes de avançar nas regras mais pesadas.

### 6. Compra parcial e reaproveitamento da lista

- [x] Transferir para o estoque apenas os itens marcados como comprados.
- [x] Manter os itens desmarcados na lista para a próxima compra.
- [x] Criar ação para duplicar a última lista de compras.
- [x] Sinalizar preço com mais de 30 dias durante a edição.

Observações:

- Tem valor prático direto e reduz retrabalho do usuário.
- Depende de histórico da lista e de data de atualização do preço.
- Fica mais simples depois da consolidação do modelo de dados.

### 7. Unidade composta e consumo por porção

- [ ] Permitir unidade composta no cadastro do produto.
- [ ] Guardar fator de conversão entre unidade comprada e unidade consumida.
- [ ] Descontar o estoque corretamente ao consumir uma porção.
- [ ] Suportar consumo rápido e consumo customizado.

Observações:

- É uma regra de domínio mais sensível e precisa de testes fortes.
- Não vale começar por aqui antes de consolidar o modelo.
- É um diferencial importante, mas não é o primeiro ganho de valor.

### 8. Histórico financeiro e data retroativa

- [ ] Registrar a última compra com custo e data.
- [ ] Permitir editar a data de lançamento de compras passadas.
- [ ] Ordenar e calcular relatórios usando a data editada.
- [ ] Exibir histórico financeiro no estoque e/ou na tela de detalhe.

Observações:

- É uma camada de rastreabilidade, não o núcleo da experiência diária.
- Depende fortemente da persistência e do histórico de movimentações.
- Deve entrar depois que os fluxos principais já estiverem estáveis.

## Progresso

- Status sugeridos:
  - `todo`: não iniciado
  - `doing`: em andamento
  - `done`: concluído
  - `blocked`: depende de outra decisão ou refatoração

### Painel de acompanhamento

- [x] 0. Integração com Supabase
- [x] 1. Pendentes de validade no topo
- [x] 2. Filtros por chips sticky com múltipla seleção
- [x] 3. Edição principal em bottom sheet
- [x] 4. Input inteligente da lista
- [ ] 5. Consolidação do modelo de dados
- [x] 6. Compra parcial e reaproveitamento da lista
- [ ] 7. Unidade composta e consumo por porção
- [ ] 8. Histórico financeiro e data retroativa

## Notas de execução

### Arquitetura atual (após integração com Supabase)

```
App.tsx (sempre usa ComprasWebShell)
  ↓
ComprasWebShell (shell principal, rotas, auth)
  ├─ LoginPage / RegisterPage (autenticação Supabase)
  ├─ GroupPage (seleção de grupo)
  ├─ StockPageNew (novo - usa ShoppingListView + StockView)
  └─ ListPageNew (novo - usa ShoppingListView com smart input)
      ↓
      useInventoryFeatureWeb (bridge hook)
        ↓
        useStockStore (Zustand + webData + Supabase)
        ↓
        Supabase (dados persistentes em tempo real)
```

### Fluxo de dados

1. **Entrada**: Usuário faz login na ComprasWebShell
2. **Auth**: LoginPage chama `supabase.auth.signInWithPassword`
3. **Setup**: Grupos e contexto carregam de `webData.loadUserGroups`
4. **Estoque**: StockPageNew chama `useStockStore.fetchItems(groupId)`
5. **UI**: StockView renderiza via `useInventoryFeatureWeb.products`
6. **Update**: Edição chama `useStockStore.upsertItem` que persiste em Supabase
7. **Sync**: Real-time via Supabase channels atualiza automaticamente

### Estratégia de entrega

- Sempre registrar a decisão arquitetural antes de abrir um item grande.
- Preferir entregar uma fatia funcional pequena e testável por vez.
- Se surgir conflito entre a feature nova e a camada legada, decidir qual vira base antes de expandir mais regras.
- Atualizar este arquivo após cada etapa concluída para manter o contexto vivo.
- Referência de modelagem atual: docs/SUPABASE_DATA_MODEL_V2.md

### Próximos passos após item 5

Quando a consolidação do modelo for concluída:
- Item 6: Usar shopping list store existente e integrar compra parcial
- Item 7: Estender StockItemRecord com unidade composta
- Item 8: Histórico via movimentações com data editável
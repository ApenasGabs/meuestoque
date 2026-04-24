
# Documentação de Produto: App "Meu Estoque"
**Versão:** 3.0 (Consolidada v1 + v2 + Edge Cases)
**Conceito Geral:** App híbrido que une *Lista de Compras* + *Controle de Estoque* + *Histórico Financeiro*. Foco absoluto em velocidade na criação de itens (Input Inteligente) e precisão no controle de consumo (Unidades Compostas).

---

## 1. Tela de Estoque (Listagem Principal)

### 1.1 Layout do Card de Produto
* **Ação Principal:** O clique no card inteiro abre a *Bottom Sheet / Modal* de edição completa do produto.
* **Botão "Consumir":** Área de toque mínima de 44x44px.
    * *Clique simples:* Consome 1 porção padrão (definida na edição).
    * *Clique longo:* Abre modal rápido para "Consumir quantidade customizada".
* **Toggle "Mostrar valores":** Fica no header da lista (OFF por padrão). Quando ON, exibe abaixo do nome de cada item o dado financeiro: `Último custo: R$ X,XX/unidade em DD/MM/AA`.
* **Controle de Quantidade:** Removido da listagem. Não existem botões de `+` ou `-` na tela principal para evitar cliques acidentais. A edição de quantidade é feita apenas no detalhe do produto ou via botão "Consumir".

### 1.2 Regra de Validade ("Pendentes")
* **Comportamento Visual:** Itens recém-comprados ou próximos do vencimento entram no estoque com uma tag vermelha destacada `Pendente Validade`.
* **Ordenação Absoluta (Pinning):** Itens pendentes são **sempre fixados no topo da lista**.
* **Sobrescrita de Filtros:** A regra de validade tem prioridade máxima. Mesmo se o usuário aplicar filtros (ex: "Café da manhã"), os itens pendentes continuarão visíveis no topo, ignorando o filtro, para garantir que o alerta nunca seja ocultado.
* **Resolução:** Clicar no item abre um modal rápido com apenas um input: "Data de Validade". Ao salvar, a tag some e o item desce para a ordenação padrão.

---

## 2. Sistema de Filtros e Categorização

### 2.1 Nomenclatura Padrão
Para unificar a arquitetura de dados (resolvendo o conflito Setor vs. Tipo), as entidades são divididas em:
1.  **Categoria de Produto:** Hortifruti, Carnes, Laticínios, Grãos, Limpeza, **Outros** (Categoria Padrão).
2.  **Momento de Consumo (Tags):** Café da manhã, Almoço, Lanche, Jantar. O app sugere a tag conforme o horário (ex: 06h-10h = Café), mas permite sobrescrita manual.

### 2.2 UI e UX dos Filtros
* **Chips Visíveis:** O dropdown tradicional foi substituído por *Chips/Tags* horizontais no topo da tela.
* **Comportamento Sticky:** A barra de filtros e o contador de itens ("X itens listados") **grudam no topo da tela** durante o scroll da lista.
* **Zero State:** Quando nenhum filtro está selecionado, o app exibe o **estoque completo**.
* **Filtro Múltiplo:** O usuário pode ativar múltiplas tags simultaneamente. A lógica de exibição deve agrupar os resultados para facilitar a visualização de categorias complementares.

---

## 3. Tela de Lista de Compras e Input Inteligente

### 3.1 Input Inteligente (Parser em Tempo Real)
Foco em velocidade extrema. O formato base é: `Nome, quantidade, valor`.
* **Feedback Visual Real-time:** Conforme o usuário digita as vírgulas, a UI já renderiza/destaca visualmente o que está sendo interpretado (ex: transforma o número isolado em um badge de quantidade).
* **Categoria Padrão ("Outros"):** Para não interromper o fluxo de digitação rápida, qualquer item adicionado via input rápido que não tenha categoria especificada é automaticamente salvo na Categoria **"Outros"**. O usuário pode alterar isso depois.
* **Casos de Uso do Parser:**
    1.  `Pão` → Cria: Pão, 1 un, R$ 0,00, Cat: Outros.
    2.  `Pão, 2` → Detecta número → Abre Select inline `[kg▼][L▼][un▼][composta]` → Cria: Pão, 2 un.
    3.  `Pão, 2, 8.50` → Cria: Pão, 2 un, R$ 8,50.

### 3.2 Unidade Composta (Lógica Core)
Resolve o problema de itens comprados por peso, mas consumidos por unidade.
* **Fluxo:** Ao selecionar unidade `composta`, abrem-se dois campos. Exemplo de input: `Tomate, 2 kg = 7 un, 15.00`.
* **Processamento de Back-end:** O sistema calcula e armazena o fator de conversão.
    * *Cálculos automáticos:* Custo/kg = R$ 7,50 | Custo/un = R$ 2,14 | Peso médio = 285g/un.
* **Consumo:** Ao clicar em "Consumir 1 un", o banco de dados desconta `0.285 kg` do estoque total.

### 3.3 Gestão de Checklist e Reaproveitamento
* **Comportamento de Compra Parcial:** Ao finalizar uma compra de mercado, apenas os itens com a checkbox "Comprado" marcada são transferidos para o Estoque. Itens desmarcados permanecem na lista para a próxima ida ao mercado.
* **Duplicar Lista:** Botão no histórico de compras que copia todos os itens, quantidades e valores da última vez.
* **Alerta de Inflação:** Durante a edição da lista, se o preço salvo for mais velho que 30 dias, o item recebe um destaque amarelo (`Preço >30 dias`) para incentivar a revisão do valor no mercado.

---

## 4. Edição de Itens e Histórico Financeiro

### 4.1 Campos de Edição do Produto
A edição avançada (ícone de Lápis) abre uma *Bottom Sheet* contendo:
* Nome.
* Unidade de Estoque (Como é armazenado: kg, L, un, pct).
* Porção de Consumo (Quanto sai por clique: 100g, 200ml, 1 un).
* Quantidade em Estoque (Saldo atual).
* Valor unitário ou total.
* Categoria de Produto & Momento de Consumo.

### 4.2 Consistência Financeira
* **Dados no Estoque:** O sistema exibe sempre o custo e a data da **última compra** daquele produto.
* **Edição de Data (Retroativa):** O histórico de compras permite alterar a data do lançamento (ex: lançar dia 22 uma compra feita dia 08). O banco de dados deve usar a *data editada* para a ordenação e cálculos financeiros, garantindo que os relatórios de gastos mensais sejam precisos.

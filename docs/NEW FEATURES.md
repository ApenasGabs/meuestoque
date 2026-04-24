
#### *1. Conceito Geral*

App híbrido que une *Lista de Compras* + *Controle de Estoque* + *Histórico Financeiro*. Foco em velocidade na criação e precisão no controle. Usuário não perde dado nem tempo.

#### *2. Tela de Estoque - Listagem Principal*

*2.1 Layout do Card de Produto*  

- *Clique no card inteiro*: Abre tela de edição completa do produto

- *Botão "Consumir"*: Área mínima 44x44px. Clique simples = consome 1 porção padrão. Clique longo = modal "Consumir quantidade customizada"

- *Toggle "Mostrar valores"*: No header da lista. OFF por padrão. Quando ON, exibe abaixo do nome: `Último custo: R$ X,XX/unidade em DD/MM/AA`

*2.2 Controle de Quantidade*  

- *Removido da lista*: Não existe botão +/- na listagem. Evita clique acidental

- *Exclusivo na edição*: Quantidade só é alterada na tela "Editar Produto"

*2.3 Tags por Horário/Refeição*  

- *Tags pré-definidas*: Café da manhã, Almoço, Lanche, Jantar

- *Seleção automática*: App sugere tag conforme horário. 06h-10h=Café, 11h-14h=Almoço, 18h-22h=Jantar

- *Campo na edição*: "Horário de consumo" funciona como subcategoria pra facilitar filtros futuros

- *Sobrescrita manual*: Usuário pode trocar a tag sugerida

*2.4 Sistema de Filtros*  

- *Substituir Select*: Trocar dropdown atual por chips/tags visíveis no topo

- *Filtro múltiplo*: Tocar numa tag ativa/desativa. Pode selecionar várias

- *Categorias duplas*: 1. Por refeição: Café, Almoço, Jantar  2. Por tipo: Hortifruti, Carnes, Laticínios, Grãos, Limpeza

- *Contador*: Mostrar "X itens" após filtrar

*2.5 Pendentes de Validade*  

- *Sem tela separada*: Itens recém-comprados entram no estoque com tag vermelha `Pendente Validade`

- *Ordenação*: Itens pendentes sempre no topo da lista

- *Resolução*: Clicar no item abre modal rápido só com campo "Data de Validade". Salva e tag some

#### *3. Tela de Lista de Compras*

*3.1 Criação Rápida - Input Inteligente v2*  

Formato: `Nome, quantidade, valor`  

Parser aceita parcial:

1. `Pão` → Cria: Pão, 1 un, R$ 0,00

2. `Pão, 2` → Detecta número → Abre Select inline `[kg▼][L▼][un▼][composta]` → Escolhe → Fica `Pão, 2 un,`

3. `Pão, 2, 8.50` → Cria: Pão, 2 un, R$ 8,50

*3.2 Unidade Composta - Diferencial do App*  

Para produtos a granel vendidos por peso mas usados por unidade.  

Fluxo: Seleciona `composta` → Abre 2 campos  

Ex: `Tomate, 2 kg = 7 un, 15.00`  

*App calcula e guarda*: Custo/kg R$ 7,50 | Custo/un R$ 2,14 | Peso médio 285g/un  

*Benefício*: Consome "1 un" e desconta 285g do estoque. Compara preço kg vs bandeja.

*3.3 Funcionamento como Checklist*  

- *Múltiplas listas*: Usuário pode ter várias listas salvas vindas do histórico

- *Marcar comprados*: Checkbox em cada item

- *Finalizar compra*: Botão só habilita com ≥1 item marcado

- *Comportamento*: Itens marcados somem da lista e vão pro estoque. Não marcados continuam na lista pra próxima vez

- *Arquivar lista*: Botão pra descartar itens que desistiu de comprar

*3.4 Reaproveitar Lista Antiga*  

- *Botão "Duplicar lista"*: No histórico de compras. Traz todos itens com qtd e valor da última vez

- *Edição rápida*: Usuário clica no lápis de cada item pra ajustar o que mudou

- *Alerta preço defasado*: Destacar em amarelo "Preço >30 dias" pra revisão

*3.5 Edição de Item - Ícone Lápis*  

Todo item tem lápis que abre sheet com:

1. Nome

2. Quantidade

3. Unidade: un, kg, L, g, ml, cx, pct + toggle "Usar unidade composta"

4. Valor unitário ou total

5. Categoria/Tags: Hortifruti, Café da manhã, etc

6. Botões Salvar e Excluir item

#### *4. Regras de Consumo de Estoque*

*4.1 Campos na Edição do Produto*

Campo | Exemplo | Função

**Unidade de estoque** | kg, L, un, pct | Como é armazenado

**Porção de consumo** | 100g, 200ml, 1 un | Quanto sai por clique

**Qtd em estoque** | 1.5 kg | Saldo atual

*4.2 Lógica do Botão Consumir*  

- *Produto "un"*: Pacote de Arroz 5kg, Porção=1un → Consome 1 → Estoque 10→9

- *Produto "kg"*: Queijo, Porção=100g → Consome 1 → Estoque 1.500kg→1.400kg

- *Produto "composto"*: Tomate com fator 285g/un → Consome 1un → Desconta 0.285kg

*4.3 Histórico de Consumo*  

Guarda log: "Consumido 100g de Queijo em 22/04/26" pra estimar duração do produto.

#### *5. Histórico e Dados Financeiros*

*5.1 Histórico de Compras*  

- *Tela dedicada*: Lista todas compras finalizadas

- *Editar data*: Botão pra corrigir data se lançou atrasado. Ex: comprei dia 08, lancei dia 22

- *Objetivo*: Relatório de gastos real, sem distorção de data

*5.2 Dados no Estoque*  

- *Sempre da última compra*: Mostra custo e data da compra mais recente daquele produto+unidade

- *Formato*: `Último custo: R$ 42,90/kg em 12/03/26`

- *Objetivo*: Noção imediata se produto subiu de preço

#### *6. Regras de Negócio Críticas Resolvidas*

Problema | Solução Implementada

**Comprei só 6 de 8 itens** | Itens não marcados ficam na lista. Nada se perde

**Tomate: 2kg vs 7un** | Unidade composta calcula fator de conversão automático

**Preço defasado no estoque** | Mostra data da última compra + alerta se >30 dias

**Não sei preço na hora** | Input parcial aceita só nome. Edita valor depois

**Unidade errada** | Produto = Nome + Unidade. "Tomate kg" ≠ "Tomate bandeja"

**Validade é chato cadastrar** | Tag pendente no topo do estoque + modal de 1 campo

#### *7. Decisões de UX Definidas*

1. *Velocidade > Precisão na criação*: Input inteligente pra adicionar em 3s

2. *Precisão > Velocidade na edição*: Lápis abre sheet completa pra ajuste fino

3. *Informação contextual*: Mostrar preço+data no estoque pra decisão de compra

4. *Não criar telas desnecessárias*: Pendentes de validade vira tag, não tela nova

5. *Padrões inteligentes*: Porção default 100g/100ml/1un, mas sempre editável

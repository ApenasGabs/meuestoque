# 🎨 02: UX e Regras de Negócio Core

Este documento sumariza as regras de experiência do usuário (UX) e as decisões de domínio que pautam a interface do "Meu Estoque".

## 1. Contexto Dinâmico (Meu Estoque vs Nosso Estoque)

O aplicativo funciona em dois modos:
- **Solo ("Meu Estoque")**: Quando o `groupId` é null ou inexistente. Domínio: `meuestoque.apenasgabs.dev`.
- **Compartilhado ("Nosso Estoque")**: Quando o `userId` está vinculado a um `groupId` ativo. Domínio: `nossoestoque.apenasgabs.dev`.
- **Implementação**: Controlado pelos hooks `useAppMode` e `useSubdomainSync` (que gerencia o `history.replaceState` sem recarregar a página e mantém o título do documento dinâmico).

## 2. Estoque e Gestão "Zero Fricção"

### Validade Pendente (Pinning Absoluto)
- Itens recém-comprados recebem uma tag vermelha **Pendente Validade**.
- Eles ficam *presos no topo* do estoque, ignorando qualquer filtro ativo, até que o usuário clique e defina a validade em um modal rápido.
- O objetivo é evitar débito técnico nos dados.

### Botão Consumir & Edição
- A tela principal *não possui* controles de `+` e `-`. Isso evita toques acidentais.
- Um clique simples no botão "Consumir" consome a porção configurada.
- Clique longo permite "Consumir customizado".
- Clicar no card do produto abre uma "Bottom Sheet" contendo a edição complexa (mudança de unidade, categoria, porção, correção de estoque).

### Seleção em Massa (Bulk Mode) e Validade
- O usuário pode realizar um `Long Press` (Clique longo/clique direito) em qualquer card do estoque para ativar a **Seleção em Massa**.
- Na barra inferior fixada (Action Bar), o usuário pode definir a **Validade em Massa** ou marcar múltiplos itens como **"Não se aplica"** (não perecíveis).
- **Prevenção de Erros:** Misturar categorias incompatíveis (ex: Alimentos + Limpeza) desabilita a opção "Não se aplica" para evitar corrupção lógica do catálogo.
- **Conflito de Datas:** Caso itens selecionados já possuam data, o sistema avisa e permite "Sobrescrever Todos" ou "Aplicar apenas aos sem data".

## 3. Categorização em Chips (Sticky Filters)

O sistema abandonou o Dropdown em favor de **Chips** selecionáveis:
- A barra de filtros gruda no topo (`sticky`).
- Suporta múltipla seleção (Ex: `Laticínios` e `Café da manhã` ao mesmo tempo).
- Categorias padrões do sistema: Hortifruti, Carnes, Laticínios, Grãos, Limpeza, e **Outros** (categoria padrão caso o input seja apressado).

## 4. Input Inteligente (Parser da Lista de Compras)

Para adicionar itens na lista de compras em velocidade recorde:
- O sistema aceita a digitação livre no formato: `Nome, quantidade, valor`.
- Exemplo: Ao digitar `Pão, 2, 8.50`, a interface (em tempo real) detecta as vírgulas e "chipa" as informações, gerando um item validado pronto para o carrinho.
- Qualquer adição apressada (sem categoria) cai direto em "Outros" para não travar o usuário.

## 5. Unidade Composta e Fator Financeiro

O aplicativo resolve o clássico problema "Comprei por Peso, uso por Unidade".
- **Composta:** O usuário pode declarar: "Comprei 2kg de tomate e vieram 7 tomates, paguei R$15".
- O sistema grava a compra de 2kg e descobre automaticamente o peso unitário (~285g/tomate) e o valor.
- Ao clicar em "Consumir 1 un" no estoque, o banco debita `0.285 kg`.

## 6. Reaproveitamento da Lista

- Quando a compra é finalizada, **apenas itens marcados** vão para o estoque.
- Itens desmarcados "sobram" na lista de compras ativa, facilitando idas múltiplas ao mercado para resolver faltas na prateleira.
- Existe um alerta "Preço > 30 dias" para informar inflação ou preço defasado nos itens da lista que estão reaproveitando dados históricos.

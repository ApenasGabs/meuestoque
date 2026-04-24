# Supabase Data Model V2 - Meu Estoque

## Objetivo
Consolidar um modelo de dados unico para suportar:
- Lista de compras (input inteligente, compra parcial, duplicacao)
- Estoque (consumo rapido e customizado)
- Unidade composta (compra por peso, consumo por unidade)
- Lotes/validade
- Historico financeiro com data retroativa

## Estado atual (resumo)
Hoje a aplicacao ja usa:
- groups
- group_members
- profiles
- shopping_lists
- items
- stock_items
- stock_movements

Pontos fortes atuais:
- Fluxo de auth/grupo funcionando
- Lista ativa por grupo
- Compra parcial funcionando
- Movimentacao de estoque e consumo automatico

Gaps para features restantes:
- item de lista usa quantidade como string (dificulta regra de unidade composta)
- sem rastreio de lote por compra
- historico financeiro sem granularidade por lote e sem data retroativa de compra
- sem separacao clara entre cadastro de produto e saldo de estoque

## Modelo alvo (V2)

### 1) Entidades de identidade e colaboracao
- profiles (id, nome, ...)
- groups (id, nome, codigo_convite, ...)
- group_members (group_id, user_id, role, created_at)

### 2) Catalogo de produtos (novo)
Tabela: product_catalog
- id uuid pk
- group_id uuid fk -> groups.id
- nome text not null
- categoria text not null default 'Outros'
- consumo_tag text null (Cafe, Almoco, etc)
- unidade_estoque text not null (kg, L, un, pct...)
- unidade_tipo text not null check ('simple','composite')
- porcao_padrao numeric(12,4) not null default 1
- unidade_porcao text not null default 'un'
- ativo boolean not null default true
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Indice recomendado:
- unique (group_id, lower(nome), unidade_estoque)

### 3) Conversao para unidade composta (novo)
Tabela: product_unit_conversion
- product_id uuid pk fk -> product_catalog.id
- compra_quantidade numeric(12,4) not null
- compra_unidade text not null
- rendimento_quantidade numeric(12,4) not null
- rendimento_unidade text not null
- fator_consumo_em_estoque numeric(18,8) not null
  (ex: 1 un consome 0.285 kg)
- created_at timestamptz default now()
- updated_at timestamptz default now()

Regra:
- obrigatorio quando unidade_tipo='composite'

### 4) Lista de compras
Tabela existente: shopping_lists
Sugestao de campos adicionais:
- status text not null default 'active' check ('active','closed','archived')
- fechado_por uuid null fk -> profiles.id
- finalized_at timestamptz (substitui/espelha finalizada_em)
- closed_purchase_date date null (data retroativa da compra)

Indice critico:
- unique parcial para uma lista ativa por grupo:
  unique (group_id) where status='active'

Tabela existente: items (renome futuro para shopping_list_items)
Evolucao recomendada:
- id uuid pk
- list_id uuid fk -> shopping_lists.id
- product_id uuid null fk -> product_catalog.id
- nome text not null
- quantidade_num numeric(12,4) null
- unidade text null
- quantidade_raw text not null (compatibilidade com parser atual)
- categoria text not null default 'Outros'
- comprado boolean not null default false
- preco_total numeric(12,2) null
- preco_unitario numeric(12,4) null
- comprado_em timestamptz null
- criado_por uuid null fk -> profiles.id
- criado_em timestamptz not null default now()
- atualizado_em timestamptz not null default now()

Observacao:
- manter quantidade_raw durante migracao
- usar quantidade_num + unidade para novas regras

### 5) Estoque consolidado
Tabela existente: stock_items
Papel no V2: saldo agregado por produto

Campos principais:
- id uuid pk
- group_id uuid fk -> groups.id
- product_id uuid fk -> product_catalog.id
- quantidade_atual numeric(12,4) not null
- quantidade_minima numeric(12,4) not null default 0
- na_lista boolean not null default false
- auto_adicionar_lista boolean not null default false
- data_validade_alerta date null
- updated_at timestamptz not null default now()

Indice:
- unique (group_id, product_id)

### 6) Lotes de compra (novo)
Tabela: stock_lots
- id uuid pk
- stock_item_id uuid fk -> stock_items.id
- source_list_item_id uuid null fk -> items.id
- quantidade_inicial numeric(12,4) not null
- quantidade_restante numeric(12,4) not null
- unidade text not null
- custo_total numeric(12,2) null
- custo_unitario numeric(12,6) null
- data_compra date not null
- data_validade date null
- created_by uuid null fk -> profiles.id
- created_at timestamptz default now()

Regra de consumo:
- baixar estoque por FIFO de lotes com data_validade prioritaria

### 7) Movimentacoes (ja existe, ampliar)
Tabela existente: stock_movements
Campos alvo:
- id uuid pk
- stock_item_id uuid fk -> stock_items.id
- lot_id uuid null fk -> stock_lots.id
- tipo text not null check ('entrada','saida','ajuste','consumo_auto','consumo_manual','compra')
- quantidade numeric(12,4) not null
- unidade text not null
- custo_unitario_ref numeric(12,6) null
- observacao text null
- origem text null (list_finalize, quick_consume, import, adjustment)
- source_list_id uuid null fk -> shopping_lists.id
- source_list_item_id uuid null fk -> items.id
- criado_por uuid null fk -> profiles.id
- criado_em timestamptz not null default now()

## Regras transacionais recomendadas (RPC Supabase)

### rpc_finalize_shopping_list(list_id uuid, purchase_date date default current_date)
Passos atomicos:
1. validar permissao do usuario no group_id da lista
2. travar lista (status active -> closed)
3. separar itens comprados e pendentes
4. para cada comprado:
   - resolver product_catalog (por product_id ou por nome+unidade)
   - criar/atualizar stock_items
   - criar stock_lots
   - criar stock_movements tipo='compra'
5. criar nova lista ativa do grupo
6. copiar pendentes para nova lista (comprado=false)
7. retornar next_list_id e estatisticas

### rpc_duplicate_history_list(source_list_id uuid)
- valida membro do grupo
- garante lista ativa
- copia itens faltantes (evitar duplicata por chave normalizada)

### rpc_consume_stock(stock_item_id uuid, quantity numeric, mode text)
- resolve unidade simple/composite
- baixa saldo agregado
- baixa lotes por FIFO
- grava movimentos
- liga auto-adicao em lista quando atingir minimo

### rpc_update_purchase_date(list_id uuid, purchase_date date)
- atualiza shopping_lists.closed_purchase_date
- recalcula data_compra e custo de lotes/movimentos relacionados (quando aplicavel)

## RLS recomendada

### Principio
Tudo escopado por membership em group_members.

### Leitura/escrita
Permitir acesso quando:
exists (
  select 1 from group_members gm
  where gm.group_id = <row.group_id>
    and gm.user_id = auth.uid()
)

### Tabelas sem group_id direto
Usar join por fk para resolver group_id:
- items -> shopping_lists.group_id
- stock_lots -> stock_items.group_id
- stock_movements -> stock_items.group_id

## Integridade e constraints criticas
- check quantidade >= 0 em saldos e lotes
- check custo >= 0
- check status valido da lista
- trigger updated_at para tabelas mutaveis
- unique parcial de lista ativa por grupo
- unique de produto por (group_id, nome normalizado, unidade_estoque)

## Estrategia de migracao (sem quebra)

### Fase A (aditiva)
1. criar product_catalog, product_unit_conversion, stock_lots
2. adicionar colunas novas em shopping_lists/items/stock_items/stock_movements
3. criar indices e constraints nao destrutivas

### Fase B (backfill)
1. gerar product_catalog a partir de stock_items atuais
2. preencher product_id em stock_items
3. preencher product_id em items por matching normalizado
4. iniciar lotes iniciais sinteticos para saldo atual

### Fase C (dual-write)
1. frontend continua gravando fluxo atual
2. rpc novas passam a gravar modelo novo e legado em paralelo
3. validar consistencia por views de auditoria

### Fase D (switch)
1. frontend migra para RPCs finais
2. remover dependencia de quantidade_raw em regras novas
3. opcionalmente renomear items -> shopping_list_items

## Views uteis para produto
- v_stock_dashboard: saldo + minimo + validade + ultimo custo
- v_price_last_purchase: ultimo custo por produto/unidade
- v_monthly_spend: gasto mensal por grupo com data retroativa
- v_consumption_projection: media de consumo e previsao de ruptura

## Mapeamento com checklist
- Item 5 (consolidacao de modelo): product_catalog + lotes + movimentos enriquecidos
- Item 7 (unidade composta): product_unit_conversion + rpc_consume_stock
- Item 8 (historico financeiro): closed_purchase_date + lotes + views mensais

## Proximo passo recomendado no Supabase
1. Criar migracao SQL da Fase A
2. Criar rpc_finalize_shopping_list transacional
3. Criar policy RLS completa das novas tabelas
4. Fazer backfill inicial em ambiente de desenvolvimento
5. Validar com um grupo real e dados de teste

# 📦 Meu Estoque - Documentação Funcional

Este documento descreve detalhadamente todas as funcionalidades do sistema **Meu Estoque**, um aplicativo focado no gerenciamento de consumo doméstico, unindo lista de compras, controle de estoque e histórico financeiro.

---

## 1. Autenticação e Perfil
- **Registro e Login**: Acesso via e-mail e senha gerenciado pelo Supabase Auth.
- **Perfil do Usuário**: Gerenciamento de nome de exibição e informações básicas de conta.

## 2. Gestão de Grupos (Residências)
O sistema é multi-inquilino baseado em grupos, permitindo que múltiplos usuários compartilhem o mesmo estoque e lista de compras.
- **Criação de Grupo**: Usuários podem criar um novo grupo e recebem um código de convite único.
- **Entrada em Grupo**: Participação em grupos existentes via código de convite.
- **Membros**: Visualização de quem faz parte do grupo atual.

## 3. Controle de Estoque (Inventory)
Funcionalidade central para rastrear o que há em casa.
- **Gerenciamento de Produtos**: Cadastro de itens com nome, categoria, quantidade atual e quantidade mínima.
- **Categorização Inteligente**: Organização por categorias (Hortifruti, Carnes, Limpeza, etc.) para facilitar a localização.
- **Movimentação de Estoque**:
    - **Entrada**: Via finalização da lista de compras ou ajuste manual.
    - **Saída**: Ajuste manual de consumo (decremento de quantidade).
- **Alertas de Estoque Baixo**: Itens abaixo da quantidade mínima são destacados e podem ser adicionados automaticamente à lista de compras.
- **Gestão de Validade (Zero Fricção)**: 
    - Itens sem validade recebem uma tag "Pendente Validade" e ficam no topo da lista.
    - Suporte a múltiplas datas de validade via sistema de lotes (FIFO).
- **Conversão de Unidades**:
    - Permite comprar em pacotes (ex: Caixa com 12) e consumir em unidades (ex: 1 unidade).
    - O sistema calcula automaticamente o peso ou quantidade fracionada baseada no `tamanho_porcao`.

## 4. Lista de Compras (Shopping List)
Workflow dinâmico para preparação e execução de compras.
- **Lista Ativa Única**: Cada grupo possui apenas uma lista de compras ativa por vez.
- **Input Inteligente (Parser v2)**: Adição de itens via texto natural (ex: `Leite, 3, 4.50` adiciona 3 unidades a R$ 4,50 cada).
- **Gerador de Lista Inteligente**: Adiciona automaticamente todos os itens que estão abaixo do estoque mínimo.
- **Importação de Recibo**: Parser para colar textos de cupons fiscais (suporte a formatos como Tenda e Pague Menos) para importação em massa.
- **Controle de Preços**:
    - Registro de preço total ou preço unitário.
    - Alerta de preço defasado (mais de 30 dias).
- **Finalização de Compra**:
    - Processa todos os itens marcados como "comprados".
    - Atualiza o estoque automaticamente (com conversão de unidade se necessário).
    - Cria lotes de estoque com a data de validade informada.
    - **Reaproveitamento**: Itens não comprados são movidos automaticamente para a próxima lista de compras ativa.

## 5. Histórico e Finanças
- **Histórico de Compras**: Visualização de todas as listas finalizadas anteriormente.
- **Resumo Financeiro**: Valor total gasto em cada compra.
- **Ajuste de Datas**: Possibilidade de alterar a data em que a compra foi realizada para fins de histórico.

## 6. Diferenciais Técnicos
- **Offline Sync (PWA Ready)**: Uso de Zustand com persistência em LocalStorage para funcionamento básico sem rede.
- **Real-time**: Sincronização em tempo real via Supabase Channels entre membros do mesmo grupo.
- **UX Focada em Mobile**: Interface otimizada para uso com uma mão durante as compras.

---
*Documentação gerada em 25/04/2026.*

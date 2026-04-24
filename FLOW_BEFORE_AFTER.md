# 🎬 FLUXO DE CORREÇÃO - ANTES E DEPOIS

---

## ❌ CENÁRIO 1: Adicionar Item à Lista (ANTES)

```
User clica em "Adicionar Item"
        ↓
Frontend coleta: nome, quantidade, categoria, preço
        ↓
TypeScript chama: supabase.from("items").insert({
  list_id: ...,
  nome: "Leite",
  quantidade: "2 L",
  categoria: "Bebidas",
  preco: null,
  comprado: false
})
        ↓
Supabase recebe INSERT
        ↓
Trigger: trg_items_updated_at ativa
        ↓
Função: set_updated_at()
        ↓
TENTA: new.updated_at = now()
        ↓
❌ ERROR: Column "updated_at" does not exist!
        ↓
Frontend mostra erro:
"record "new" has no field "updated_at""
        ↓
Item NÃO é inserido na lista ❌
```

---

## ✅ CENÁRIO 1: Adicionar Item à Lista (DEPOIS)

```
User clica em "Adicionar Item"
        ↓
Frontend coleta: nome, quantidade, categoria, preço
        ↓
TypeScript chama: supabase.from("items").insert({
  list_id: ...,
  nome: "Leite",
  quantidade: "2 L",
  categoria: "Bebidas",
  preco: null,
  comprado: false
})
        ↓
Supabase recebe INSERT
        ↓
Trigger: trg_items_updated_at ativa
        ↓
Função: set_updated_at_items()  ← FUNÇÃO CORRETA
        ↓
EXECUTA: new.atualizado_em = now()  ← COLUNA CORRETA
        ↓
✅ Sucesso! Item inserido
        ↓
Frontend exibe sucesso:
Item "Leite" adicionado à lista ✅
        ↓
Item aparece na lista ✅
```

---

## ❌ CENÁRIO 2: Adicionar Item ao Estoque (ANTES)

```
User clica em "Adicionar Item ao Estoque"
        ↓
Frontend coleta: nome, quantidade (5 kg), unidade, categoria
        ↓
TypeScript chama: upsertStockItem({
  id: "uuid",
  groupId: "uuid",
  nome: "Arroz",
  quantidade: 5,
  unidade: "kg",
  categoria: "Grãos",
  ...
})
        ↓
TypeScript cria payload:
{
  id: "uuid",
  group_id: "uuid",
  nome: "Arroz",
  quantidade: 5,          ← valor preenchido
  // ⚠️ FALTA: quantidade_atual: 5
  unidade: "kg",
  categoria: "Grãos",
  ...
}
        ↓
Supabase recebe UPSERT
        ↓
Query tenta: INSERT stock_items (id, group_id, nome, quantidade, unidade, ...)
        ↓
Coluna: quantidade_atual = NULL (não foi passada)
        ↓
❌ ERROR 23502: NOT NULL constraint violado!
"null value in column "quantidade_atual" of relation "stock_items" violates not-null constraint"
        ↓
Frontend mostra erro:
Erro ao adicionar item ao estoque ❌
        ↓
Item NÃO é inserido no estoque ❌
```

---

## ✅ CENÁRIO 2: Adicionar Item ao Estoque (DEPOIS)

```
User clica em "Adicionar Item ao Estoque"
        ↓
Frontend coleta: nome, quantidade (5 kg), unidade, categoria
        ↓
TypeScript chama: upsertStockItem({
  id: "uuid",
  groupId: "uuid",
  nome: "Arroz",
  quantidade: 5,
  unidade: "kg",
  categoria: "Grãos",
  ...
})
        ↓
TypeScript cria payload:
{
  id: "uuid",
  group_id: "uuid",
  nome: "Arroz",
  quantidade: 5,          ← valor preenchido
  quantidade_atual: 5,    ← ADICIONADO! ✅
  unidade: "kg",
  categoria: "Grãos",
  ...
}
        ↓
Supabase recebe UPSERT
        ↓
Query executa: INSERT/UPDATE stock_items (id, group_id, nome, quantidade, quantidade_atual, unidade, ...)
        ↓
Coluna: quantidade_atual = 5 (foi passada) ✅
        ↓
✅ Sucesso! Item inserido/atualizado
        ↓
Frontend exibe sucesso:
Item "Arroz" adicionado ao estoque ✅
        ↓
Item aparece no estoque ✅
```

---

## 📊 Tabela Comparativa

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Adicionar à Lista** | ❌ Erro: `updated_at` | ✅ OK: `atualizado_em` |
| **Atualizar Item Lista** | ❌ Erro: `updated_at` | ✅ OK: `atualizado_em` |
| **Adicionar ao Estoque** | ❌ Erro: NOT NULL | ✅ OK: `quantidade_atual` |
| **Atualizar Estoque** | ❌ Erro: NOT NULL | ✅ OK: `quantidade_atual` |
| **Deletar Item Lista** | ✅ OK | ✅ OK |
| **Deletar Item Estoque** | ✅ OK | ✅ OK |

---

## 🔄 Fluxo Completo: Lista → Compra → Estoque

```
┌─────────────────────────────────────────────────────────────┐
│                    ANTES (COM ERROS)                         │
└─────────────────────────────────────────────────────────────┘

User inicia lista de compras
        ↓
Tenta adicionar item → ❌ ERRO: updated_at
        ↓
Não consegue adicionar itens
        ↓
Não consegue finalizar lista
        ↓
Não consegue popular estoque

┌─────────────────────────────────────────────────────────────┐
│                   DEPOIS (CORRIGIDO)                         │
└─────────────────────────────────────────────────────────────┘

User inicia lista de compras
        ↓
Adiciona itens ✅
        ↓
Atualiza preços ✅
        ↓
Marca como comprado ✅
        ↓
Finaliza lista ✅
        ↓
Items movem para estoque ✅
        ↓
Nova lista ativa criada ✅
        ↓
Estoque atualizado ✅
```

---

## 💡 Lições Aprendidas

### O que causou os erros

1. **Inconsistência de Nomes**
   - Migration adicionou `atualizado_em`
   - Trigger genérico tentava usar `updated_at`
   - Resultado: Coluna não encontrada

2. **Falta de Sincronização**
   - Migration adicionou `quantidade_atual` como NOT NULL
   - TypeScript não foi atualizado para passar o valor
   - Resultado: Constraint violation

3. **Falta de Testes**
   - Essas mudanças não foram testadas ao ser implementadas
   - Erros só foram descobertos ao testar na aplicação

### Como evitar no futuro

✅ Sempre testar migrations em dev antes de produção  
✅ Sincronizar TypeScript com mudanças de schema  
✅ Usar o mesmo teste: "criar item" após qualquer migration de schema  
✅ Documentar mudanças de triggerss em PRs  
✅ Revisar cuidadosamente mudanças do banco de dados

---

## 🚀 Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| Função para items | `set_updated_at()` (genérica) | `set_updated_at_items()` (específica) |
| Coluna atualizada | `updated_at` (não existe) | `atualizado_em` ✅ |
| Payload UPSERT | Sem `quantidade_atual` | Com `quantidade_atual` ✅ |
| Aplicações | ❌ Bloqueada | ✅ Funcionando |

---

**Status:** ✅ **TODOS OS FLUXOS DESBLOQUEADOS**


# Architectural Decision Records (ADR)

Registros de decisões arquiteturais. Cada ADR é um arquivo numerado (`NNNN-titulo-curto.md`) imutável após aceito.

## Por quê

- Capturar contexto que se perderia em commits/issues.
- Permitir revisões futuras informadas.
- Evitar redebate de decisões maduras.

## Template

```markdown
# NNNN — Título curto

- **Status:** Proposta | Aceita | Substituída por NNNN | Descontinuada
- **Data:** AAAA-MM-DD
- **Autores:** @user

## Contexto
## Decisão
## Consequências
## Alternativas consideradas
```

## Índice

| ID | Título | Status |
|---|---|---|
| [0001](./0001-validade-nao-aplica.md) | Persistir flag `validade_nao_aplica` | Aceita |

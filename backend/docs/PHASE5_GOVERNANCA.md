# Fase 5 — Governança Fiscal Avançada

## Visão Geral

Evoluir a governança fiscal de valores hardcoded para um sistema dinâmico
baseado em catálogo de regras, base legal padronizada e explicação consistente.

## O que mudou

### Antes (hardcoded)
```typescript
confidenceLevel: 'VALIDATED_BY_REGISTRATION'  // sempre o mesmo
calculationStatus: 'SUCCESS'                   // sempre o mesmo
ruleCodes: ['REGRA_ICMS_BASE', 'REGRA_PIS_BASE', ...]  // strings sem correspondência no catálogo
legalBasis: ['Operacao Normal', 'versionScope: V1 structured estimate']  // inconsistente
```

### Depois (dinâmico)
- **TaxRuleEngine** casca regras do `TaxRuleCatalog` contra o contexto do cálculo
- **Confidence/Status** variam conforme elegibilidade real dos créditos
- **ruleCodes** vêm do catálogo (códigos reais com `code` único)
- **legalBasis** é fundido dos calculadores + base legal do rule engine
- **explanation** gera resumo em linguagem natural para auditores

## Novas Entidades

### TaxRuleCatalog (expandido)
| Campo | Tipo | Descrição |
|---|---|---|
| `category` | String | ICMS \| PIS \| COFINS \| IPI \| GENERAL |
| `severity` | String | BLOCKING \| WARNING \| INFO |
| `appliesTo` | Json | Condições de aplicação (ex: `{ taxRegime: "REAL" }`) |

### TaxLegalBasis (novo)
| Campo | Tipo | Descrição |
|---|---|---|
| `code` | String | Código único (ex: "CF_ART155") |
| `lawType` | String | CF \| LC \| LEI \| DECREASE \| PORTARIA \| CONVENIO \| NOTA_TECNICA |
| `lawNumber` | String | Número da lei |
| `article` | String | Artigo específico |
| `paragraph` | String | Parágrafo/inciso |
| `url` | String | Link para texto oficial |

### TaxReviewDecision (relacionamento)
Agora tem relação Many-to-Many com `TaxRuleCatalog` via `appliedRules`.

## Novos Serviços

### TaxRuleEngine
- `evaluate(ctx)` — avalia todas as regras ativas
- `getAppliedRuleCodes(ctx)` — retorna apenas os ruleCodes aplicados
- `getAppliedLegalBasis(ctx)` — retorna bases legais das regras aplicadas
- `hasBlockingRules(ctx)` — verifica se há impedimento total

### TaxExplanationService
- `generate(ctx, branches, grossCost, ruleCodes, legalBasis)` — gera explicação completa
- Retorna: summary (linguagem natural), linhas por tributo, total créditos, custo líquido, status de bloqueio

## Seed de Dados

Executar: `npx ts-node src/seed/seed-tax-rules.ts`

Popula:
- **5 bases legais**: CF/88 Art.155, LC 123/2006, Lei 10.833/2003, Lei 9.532/1997, NT 2023.001
- **17 regras fiscais**: ICMS (7), PIS (3), COFINS (2), IPI (2), General (3)

## Regras de Governança Dinâmica

| Condição | confidenceLevel | calculationStatus |
|---|---|---|
| Regra BLOCKING aplicada | BLOCKED | BLOCKED |
| Todos créditos elegíveis | VALIDATED_BY_REGISTRATION | SUCCESS |
| Pelo menos um crédito não elegível | ESTIMATED | SUCCESS |
| Fallback | ESTIMATED | PENDING |

## Estrutura de Arquivos

```
src/modules/tax-engine/
  services/
    rule-engine/
      tax-rule.engine.ts       ← Motor de casamento de regras
    explanation/
      tax-explanation.service.ts ← Explicação consistente
  tax-engine.module.ts         ← Registrados os novos serviços
  dto/
    tax-calculation-result.dto.ts ← Campo explanation adicionado
src/seed/
  seed-tax-rules.ts            ← Seed de regras e base legal
```

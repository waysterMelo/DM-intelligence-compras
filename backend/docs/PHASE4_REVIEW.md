# Fase 4 — Revisão Especializada

## Visão Geral

Camada humana do produto. Permite que especialistas revisem cálculos fiscais
gerados pelo motor, tomem decisões auditáveis e atualizem o estado das cotações.

## Entidades

### TaxReviewQueueItem
Item na fila de revisão. Pode ser aberto automaticamente pelo motor fiscal
ou manualmente por um usuário autorizado.

**Ciclo de vida:**
```
OPEN → ASSIGNED → IN_REVIEW → RESOLVED
OPEN → ASSIGNED → IN_REVIEW → DISMISSED
```

**Severity:** LOW, MEDIUM, HIGH, CRITICAL

### TaxReviewDecision
Decisão tomada pelo especialista em um item de revisão.
Contém outcome, valores ajustados, explicação, códigos de regra e base legal.

## Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/tax-governance/reviews` | ADMIN, MANAGER, SPECIALIST | Abre revisão (manual ou auto) |
| GET | `/tax-governance/reviews/open` | Auth | Lista itens abertos (ordenado por severity) |
| GET | `/tax-governance/reviews/my` | Auth | Itens atribuídos ao usuário |
| GET | `/tax-governance/reviews/resolved` | Auth | Itens resolvidos (histórico) |
| GET | `/tax-governance/reviews/stats` | Auth | Estatísticas por status e severidade |
| GET | `/tax-governance/reviews/:id` | Auth | Detalhes de um item |
| POST | `/tax-governance/reviews/:id/assign` | ADMIN, MANAGER | Atribuir a especialista |
| POST | `/tax-governance/reviews/:id/start` | SPECIALIST, ADMIN | Iniciar revisão |
| POST | `/tax-governance/reviews/:id/resolve` | SPECIALIST, ADMIN | Resolver com decisão |
| POST | `/tax-governance/reviews/:id/dismiss` | SPECIALIST, ADMIN, MANAGER | Descartar revisão |

## Outcomes

| Outcome | Efeito na Quote |
|---------|----------------|
| `CALCULATION_ACCEPTED` | confidenceLevel → EXPERT_REVIEWED, calculationStatus → SUCCESS |
| `CALCULATION_ADJUSTED` | confidenceLevel → EXPERT_REVIEWED, calculationStatus → SUCCESS |
| `CALCULATION_REJECTED` | calculationStatus → IN_REVIEW (sem elevação de confiança) |
| `ESCALATED` | pendingReview mantém true (tratado em nível superior) |

## Regras Automáticas de Abertura

A serem implementadas no motor fiscal (Fase 5):
- `LOW_CONFIDENCE` — confidenceLevel = ESTIMATED + valor alto
- `BLOCKED` — taxCalculationStatus = BLOCKED
- `HIGH_TAX_DELTA` — diferença fiscal > threshold configurável
- `RULE_CONFLICT` — conflito de regras detectado
- `DOCUMENT_MISMATCH` — divergência entre cadastro e documento (Fase 6)

## Module Structure

```
src/modules/tax-review/
├── dto/review.dto.ts
├── repositories/tax-review.repository.ts
├── services/tax-review.service.ts
├── tax-review.controller.ts
└── tax-review.module.ts
```

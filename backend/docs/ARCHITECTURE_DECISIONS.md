# Backlog de Arquitetura — Hardening Multi-Tenant

## Task: Propagação explícita de tenantId para Quote e Requisition

### Contexto
Atualmente o isolamento multi-tenant funciona através do caminho indireto:
```
Quote -> fornecedorId -> Fornecedor.tenantId
```

Isso funciona, mas tem desvantagens:
- Toda query precisa de JOIN ou filter aninhado (`fornecedor: { tenantId }`)
- Se o `fornecedorId` de uma quote for null, o isolamento falha
- Queries analíticas e agregações são mais complexas
- Performance: índice em coluna de relação é menos eficiente que índice direto

### Proposta
Adicionar `tenantId String?` diretamente nos modelos `Quote` e `Requisition`:
- Escrita: preencher `tenantId` na criação da quote/requisition a partir do fornecedor
- Migração: backfill de `tenantId` em todas as quotes existentes via `UPDATE quote SET tenantId = (SELECT tenantId FROM fornecedor WHERE fornecedor.id = quote.fornecedorId)`
- Leitura: queries podem filtrar direto por `tenantId` sem JOIN
- Índices: criar índice composto `(tenantId, createdAt)` para queries de escopo

### Prioridade
Média. Não bloqueia a Fase 3 atual, mas é recomendado antes de escalar para múltiplos tenants em produção.

### Dependências
- Migração de dados (backfill)
- Atualizar services de criação de Quote/Requisition para setar `tenantId`
- Revisar todos os escopos de job para usar `tenantId` direto em vez de `fornecedor.tenantId`

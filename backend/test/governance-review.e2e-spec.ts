import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TaxReviewService } from '../src/modules/tax-review/services/tax-review.service';
import { TaxReviewAutoService } from '../src/modules/tax-review/services/tax-review-auto.service';
import { TaxReviewRepository } from '../src/modules/tax-review/repositories/tax-review.repository';
import { ReviewReasonCode, ReviewSeverity, ReviewOutcome, CreateReviewDto, AssignReviewDto, DismissReviewDto, ResolveReviewDto } from '../src/modules/tax-review/dto/review.dto';
import { PrismaService } from '../src/prisma.service';

/**
 * ==========================================
 * Test: Governance + Review
 * ==========================================
 * Integration tests for Phase 4 + Phase 5
 * Tests service layer directly (not HTTP) to avoid auth guard issues.
 *
 * Scenarios covered:
 *  1.  Review open + idempotency
 *  2.  Assign (OPEN -> ASSIGNED)
 *  3.  Start (ASSIGNED -> IN_REVIEW)
 *  4.  Resolve ACCEPTED
 *  5.  Resolve ADJUSTED
 *  6.  Resolve REJECTED -> PENDING
 *  7.  Resolve ESCALATED -> pendingReview stays true
 *  8.  Dismiss (OPEN -> DISMISSED)
 *  9.  Dismiss terminal state fails
 *  10. Tenant isolation
 *  11. Stats
 *  12. Auto-review evaluation
 *  13. Audit trail completeness
 */

// ==========================================
// Mock infrastructure
// ==========================================
function createMocks() {
  const reviewItems: any[] = [];
  const reviewDecisions: any[] = [];
  const quotes: Record<string, any> = {};

  return {
    _internal: { reviewItems, reviewDecisions, quotes },

    seedQuote: (id: string, overrides: any = {}) => {
      quotes[id] = {
        id,
        taxConfidenceLevel: 'ESTIMATED',
        taxCalculationStatus: 'PENDING',
        pendingReview: false,
        ...overrides
      };
    },

    seedReview: (item: any) => {
      reviewItems.push({
        id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        severity: ReviewSeverity.MEDIUM,
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE,
        status: 'OPEN',
        decisions: [],
        ...item
      });
    },

    getReview: (id: string) => reviewItems.find(i => i.id === id),
    getQuote: (id: string) => quotes[id],
    getDecision: (id: string) => reviewDecisions.find(d => d.id === id),
    reviewItemCount: () => reviewItems.length,
    decisionCount: () => reviewDecisions.length,

    mockPrisma: {
      fornecedor: {
        findFirst: jest.fn().mockImplementation(async (args) => {
          if (args.where) {
            for (const q of Object.values(quotes)) {
              if ((q as any).id === args.where.id) return q;
            }
          }
          return null;
        }),
        findUnique: jest.fn().mockResolvedValue(null)
      },
      quote: {
        findFirst: jest.fn().mockImplementation(async (args) => {
          return quotes[args.where?.id] || null;
        }),
        findUnique: jest.fn().mockImplementation(async (args) => {
          return quotes[args.where?.id] || null;
        }),
        // Tenant-scoped findFirst for validateQuoteForTenant
        update: jest.fn().mockImplementation(async (args) => {
          if (!quotes[args.where.id]) {
            // Auto-create if not exists (for updateQuoteState)
            quotes[args.where.id] = { id: args.where.id, ...args.data };
            return quotes[args.where.id];
          }
          quotes[args.where.id] = { ...quotes[args.where.id], ...args.data };
          return quotes[args.where.id];
        })
      },
      taxReviewQueueItem: {
        findMany: jest.fn().mockImplementation(async (args) => {
          return reviewItems.filter(item => {
            if (args.where?.id && item.id !== args.where.id) return false;
            if (args.where?.tenantId && item.tenantId !== args.where.tenantId) return false;
            if (args.where?.quoteId && item.quoteId !== args.where.quoteId) return false;
            if (args.where?.status) {
              if (typeof args.where.status === 'string') return item.status === args.where.status;
              if (Array.isArray(args.where.status?.in)) return args.where.status.in.includes(item.status);
            }
            return true;
          });
        }),
        findFirst: jest.fn().mockImplementation(async (args) => {
          return reviewItems.find(item => {
            if (args.where?.id && item.id !== args.where.id) return false;
            if (args.where?.tenantId && item.tenantId !== args.where.tenantId) return false;
            return true;
          }) || null;
        }),
        create: jest.fn().mockImplementation(async (args) => {
          const item = {
            id: `review-${Date.now()}`,
            ...args.data,
            createdAt: new Date()
          };
          reviewItems.push(item);
          return item;
        }),
        updateMany: jest.fn().mockImplementation(async (args) => {
          let updated = 0;
          for (const item of reviewItems) {
            if (args.where?.id && item.id !== args.where.id) continue;
            if (args.where?.tenantId && item.tenantId !== args.where.tenantId) continue;
            if (args.where?.status) {
              if (typeof args.where.status === 'string' && item.status !== args.where.status) continue;
              if (Array.isArray(args.where.status?.in) && !args.where.status.in.includes(item.status)) continue;
            }
            Object.assign(item, args.data, {
              ...(args.data.assignedAt ? { assignedAt: new Date() } : {}),
              ...(args.data.resolvedAt ? { resolvedAt: new Date() } : {})
            });
            updated++;
          }
          return { count: updated };
        })
      },
      taxReviewDecision: {
        create: jest.fn().mockImplementation(async (args) => {
          const decision = {
            id: `decision-${Date.now()}`,
            ...args.data,
            createdAt: new Date()
          };
          reviewDecisions.push(decision);
          return decision;
        }),
        findMany: jest.fn().mockResolvedValue(reviewDecisions)
      },
      taxReviewThreshold: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    }
  };
}

describe('Governance + Review — Integration Tests', () => {
  let service: TaxReviewService;
  let autoService: TaxReviewAutoService;
  let m: ReturnType<typeof createMocks>;

  beforeEach(async () => {
    m = createMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxReviewService,
        TaxReviewAutoService,
        TaxReviewRepository,
        { provide: PrismaService, useValue: m.mockPrisma }
      ]
    }).compile();

    service = module.get<TaxReviewService>(TaxReviewService);
    autoService = module.get<TaxReviewAutoService>(TaxReviewAutoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // 1. Review open + idempotency
  // ==========================================
  describe('1. Abertura de revisão', () => {
    it('autoOpen cria item e marca pendingReview', async () => {
      m.seedQuote('q1', { fornecedor: { tenantId: 'tenant-a' } });
      m.mockPrisma.quote.findFirst.mockResolvedValue({
        id: 'q1',
        taxConfidenceLevel: 'ESTIMATED'
      });

      const dto: CreateReviewDto = {
        quoteId: 'q1',
        reasonCode: ReviewReasonCode.BLOCKED,
        reasonText: 'Test',
        severity: ReviewSeverity.CRITICAL
      };

      const id = await service.autoOpen('tenant-a', dto);
      expect(id).toBeDefined();
      expect(m.getQuote('q1').pendingReview).toBe(true);
    });

    it('tentativa duplicada retorna mesmo ID (idempotência)', async () => {
      m.seedQuote('q2', { fornecedor: { tenantId: 'tenant-a' } });
      m.seedReview({
        id: 'existing-1',
        tenantId: 'tenant-a',
        quoteId: 'q2',
        status: 'OPEN',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });
      m.mockPrisma.quote.findFirst.mockResolvedValue({ id: 'q2' });

      const dto: CreateReviewDto = {
        quoteId: 'q2',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE,
        severity: ReviewSeverity.MEDIUM
      };

      const id = await service.autoOpen('tenant-a', dto);
      expect(id).toBe('existing-1');
    });
  });

  // ==========================================
  // 2. Assign (OPEN -> ASSIGNED)
  // ==========================================
  describe('2. Assign de review', () => {
    it('OPEN -> ASSIGNED', async () => {
      m.seedQuote('q3', { fornecedor: { tenantId: 'tenant-a' } });
      m.seedReview({
        id: 'r-assign',
        tenantId: 'tenant-a',
        quoteId: 'q3',
        status: 'OPEN',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });

      const ok = await service.assign('r-assign', 'tenant-a', { assignedToUserId: 'spec-1' });
      expect(ok).toBe(true);
      expect(m.getReview('r-assign').status).toBe('ASSIGNED');
      expect(m.mockPrisma.taxReviewQueueItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OPEN' }),
          data: expect.objectContaining({ status: 'ASSIGNED' })
        })
      );
    });

    it('assign em item não OPEN -> falha (409)', async () => {
      m.seedReview({
        id: 'r-already',
        tenantId: 'tenant-a',
        quoteId: 'q4',
        status: 'ASSIGNED',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });

      await expect(
        service.assign('r-already', 'tenant-a', { assignedToUserId: 'spec-2' })
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================================
  // 3. Start (ASSIGNED -> IN_REVIEW)
  // ==========================================
  describe('3. Start por usuário correto', () => {
    it('ASSIGNED -> IN_REVIEW por usuário atribuído', async () => {
      m.seedReview({
        id: 'r-start',
        tenantId: 'tenant-a',
        quoteId: 'q5',
        status: 'ASSIGNED',
        assignedToUserId: 'spec-1',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });

      const ok = await service.startReview('r-start', 'spec-1', 'tenant-a');
      expect(ok).toBe(true);
      expect(m.getReview('r-start').status).toBe('IN_REVIEW');
    });

    it('start por outro usuário -> falha (409)', async () => {
      m.seedReview({
        id: 'r-wrong',
        tenantId: 'tenant-a',
        quoteId: 'q6',
        status: 'ASSIGNED',
        assignedToUserId: 'spec-1',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });

      await expect(
        service.startReview('r-wrong', 'spec-2', 'tenant-a')
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================================
  // 4-7. Resolve com diferentes outcomes
  // ==========================================
  describe('4-7. Resolve outcomes', () => {
    it('CALCULATION_ACCEPTED -> quote SUCCESS + EXPERT_REVIEWED', async () => {
      m.seedQuote('q-accept', {
        taxCalculationStatus: 'PENDING',
        taxConfidenceLevel: 'ESTIMATED',
        pendingReview: true
      });
      m.seedReview({
        id: 'r-accept',
        tenantId: 'tenant-a',
        quoteId: 'q-accept',
        status: 'IN_REVIEW',
        assignedToUserId: 'spec-1',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE,
        severity: ReviewSeverity.MEDIUM
      });

      await service.resolve('r-accept', 'spec-1', 'tenant-a', {
        outcome: ReviewOutcome.CALCULATION_ACCEPTED,
        explanation: 'Validado',
        resolutionNotes: 'OK'
      });

      const quote = m.getQuote('q-accept');
      expect(quote.pendingReview).toBe(false);
      expect(quote.taxConfidenceLevel).toBe('EXPERT_REVIEWED');
      expect(quote.taxCalculationStatus).toBe('SUCCESS');
    });

    it('CALCULATION_ADJUSTED -> EXPERT_REVIEWED / SUCCESS', async () => {
      m.seedQuote('q-adjust', {
        taxCalculationStatus: 'PENDING',
        taxConfidenceLevel: 'ESTIMATED',
        pendingReview: true
      });
      m.seedReview({
        id: 'r-adjust',
        tenantId: 'tenant-a',
        quoteId: 'q-adjust',
        status: 'ASSIGNED',
        assignedToUserId: 'spec-1',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE,
        severity: ReviewSeverity.HIGH
      });

      await service.resolve('r-adjust', 'spec-1', 'tenant-a', {
        outcome: ReviewOutcome.CALCULATION_ADJUSTED,
        adjustedValues: { icms: 15.5 },
        explanation: 'Ajustado',
        resolutionNotes: 'Valores corrigidos'
      });

      const quote = m.getQuote('q-adjust');
      expect(quote.taxConfidenceLevel).toBe('EXPERT_REVIEWED');
      expect(quote.taxCalculationStatus).toBe('SUCCESS');
      expect(quote.pendingReview).toBe(false);
    });

    it('CALCULATION_REJECTED -> PENDING', async () => {
      m.seedQuote('q-reject', {
        taxCalculationStatus: 'SUCCESS',
        taxConfidenceLevel: 'ESTIMATED',
        pendingReview: true
      });
      m.seedReview({
        id: 'r-reject',
        tenantId: 'tenant-a',
        quoteId: 'q-reject',
        status: 'ASSIGNED',
        assignedToUserId: 'spec-1',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE,
        severity: ReviewSeverity.HIGH
      });

      await service.resolve('r-reject', 'spec-1', 'tenant-a', {
        outcome: ReviewOutcome.CALCULATION_REJECTED,
        explanation: 'Incorreto'
      });

      const quote = m.getQuote('q-reject');
      expect(quote.pendingReview).toBe(false);
      expect(quote.taxCalculationStatus).toBe('PENDING');
    });

    it('ESCALATED -> pendingReview=true mantido', async () => {
      m.seedQuote('q-esc', {
        taxCalculationStatus: 'BLOCKED',
        taxConfidenceLevel: 'BLOCKED',
        pendingReview: true
      });
      m.seedReview({
        id: 'r-esc',
        tenantId: 'tenant-a',
        quoteId: 'q-esc',
        status: 'IN_REVIEW',
        assignedToUserId: 'spec-1',
        reasonCode: ReviewReasonCode.BLOCKED,
        severity: ReviewSeverity.CRITICAL
      });

      await service.resolve('r-esc', 'spec-1', 'tenant-a', {
        outcome: ReviewOutcome.ESCALATED,
        explanation: 'Requer aprovação superior'
      });

      const quote = m.getQuote('q-esc');
      expect(quote.pendingReview).toBe(true);
    });
  });

  // ==========================================
  // 8-9. Dismiss
  // ==========================================
  describe('8-9. Dismiss', () => {
    it('dismiss válido em item OPEN -> DISMISSED', async () => {
      m.seedReview({
        id: 'r-dismiss',
        tenantId: 'tenant-a',
        quoteId: 'q7',
        status: 'OPEN',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });

      const ok = await service.dismiss('r-dismiss', 'tenant-a');
      expect(ok).toBe(true);
      expect(m.getReview('r-dismiss').status).toBe('DISMISSED');
    });

    it('dismiss em item RESOLVED -> falha (409)', async () => {
      m.seedReview({
        id: 'r-dismiss-term',
        tenantId: 'tenant-a',
        quoteId: 'q8',
        status: 'RESOLVED',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });

      await expect(
        service.dismiss('r-dismiss-term', 'tenant-a')
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================================
  // 10. Tenant isolation
  // ==========================================
  describe('10. Isolamento de tenant', () => {
    it('tenant A não acessa review do tenant B', async () => {
      m.seedReview({
        id: 'r-tenant-b',
        tenantId: 'tenant-b',
        quoteId: 'q-b1',
        status: 'OPEN',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });

      await expect(
        service.getById('r-tenant-b', 'tenant-a')
      ).rejects.toThrow(NotFoundException);
    });

    it('tenant A não resolve review do tenant B', async () => {
      m.seedReview({
        id: 'r-tenant-b2',
        tenantId: 'tenant-b',
        quoteId: 'q-b2',
        status: 'ASSIGNED',
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE
      });

      await expect(
        service.resolve('r-tenant-b2', 'spec-a', 'tenant-a', {
          outcome: ReviewOutcome.CALCULATION_ACCEPTED
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // 11. Stats
  // ==========================================
  describe('11. Stats corretos', () => {
    it('stats retorna byStatus, byReasonCode, bySeverity, openByUser, criticalCount', async () => {
      m.seedReview({ id: 's1', tenantId: 't1', status: 'OPEN', severity: 'CRITICAL', reasonCode: ReviewReasonCode.BLOCKED });
      m.seedReview({ id: 's2', tenantId: 't1', status: 'OPEN', severity: 'MEDIUM', reasonCode: ReviewReasonCode.LOW_CONFIDENCE });
      m.seedReview({ id: 's3', tenantId: 't1', status: 'RESOLVED', severity: 'LOW', reasonCode: ReviewReasonCode.RULE_CONFLICT });
      m.seedReview({ id: 's4', tenantId: 't1', status: 'IN_REVIEW', severity: 'HIGH', reasonCode: ReviewReasonCode.HIGH_TAX_DELTA });

      const stats = await service.getStats('t1');

      expect(stats.total).toBe(4);
      expect(stats.byStatus.OPEN).toBe(2);
      expect(stats.byStatus.RESOLVED).toBe(1);
      expect(stats.bySeverity.CRITICAL).toBe(1);
      expect(stats.byReasonCode[ReviewReasonCode.BLOCKED]).toBe(1);
      expect(stats.openByUser.total).toBe(2);
      expect(stats.criticalCount).toBe(2); // CRITICAL + HIGH
    });
  });

  // ==========================================
  // 12. Auto-review evaluation
  // ==========================================
  describe('12. Avaliação automática de review', () => {
    it('BLOCKED -> always opens with CRITICAL', async () => {
      const decision = autoService.evaluate({
        tenantId: 't1', buyerCompanyId: 'b1',
        calculationStatus: 'BLOCKED',
        confidenceLevel: 'BLOCKED',
        maxSeverity: 'BLOCKING',
        totalCredits: 0, grossCostTotal: 1000, netCost: 1000,
        ruleCodes: ['GEN-CONSUMO'],
        hasBlockingRule: true,
        explanationSummary: 'Bloqueado'
      });

      expect(decision.shouldOpen).toBe(true);
      expect(decision.reasonCode).toBe(ReviewReasonCode.BLOCKED);
      expect(decision.severity).toBe(ReviewSeverity.CRITICAL);
    });

    it('LOW_CONFIDENCE com WARNING -> opens MEDIUM', async () => {
      const decision = autoService.evaluate({
        tenantId: 't1', buyerCompanyId: 'b1',
        calculationStatus: 'SUCCESS',
        confidenceLevel: 'ESTIMATED',
        maxSeverity: 'WARNING',
        totalCredits: 100, grossCostTotal: 1000, netCost: 900,
        ruleCodes: ['ICMS-SIMPLES'],
        hasBlockingRule: false,
        explanationSummary: 'Observado'
      });

      expect(decision.shouldOpen).toBe(true);
      expect(decision.reasonCode).toBe(ReviewReasonCode.LOW_CONFIDENCE);
      expect(decision.severity).toBe(ReviewSeverity.MEDIUM);
    });

    it('VALIDATED sem issues -> não abre review', async () => {
      const decision = autoService.evaluate({
        tenantId: 't1', buyerCompanyId: 'b1',
        calculationStatus: 'SUCCESS',
        confidenceLevel: 'VALIDATED_BY_REGISTRATION',
        maxSeverity: 'INFO',
        totalCredits: 200, grossCostTotal: 1000, netCost: 800,
        ruleCodes: [],
        hasBlockingRule: false,
        explanationSummary: 'Normal'
      });

      expect(decision.shouldOpen).toBe(false);
    });

    it('HIGH_TAX_DELTA (>15%) -> opens HIGH', async () => {
      const decision = autoService.evaluate({
        tenantId: 't1', buyerCompanyId: 'b1',
        calculationStatus: 'SUCCESS',
        confidenceLevel: 'ESTIMATED',
        maxSeverity: 'INFO',
        totalCredits: 200, grossCostTotal: 1000, netCost: 800,
        ruleCodes: [],
        hasBlockingRule: false,
        explanationSummary: 'Delta alto'
      });

      expect(decision.shouldOpen).toBe(true);
      expect(decision.reasonCode).toBe(ReviewReasonCode.HIGH_TAX_DELTA);
      expect(decision.severity).toBe(ReviewSeverity.HIGH);
    });
  });

  // ==========================================
  // 13. Audit trail completeness
  // ==========================================
  describe('13. Trilha auditável completa', () => {
    it('resolve cria decisão com reasonCode, severityAtDecision, itemStatusAtDecision', async () => {
      m.seedQuote('q-audit', {
        taxCalculationStatus: 'PENDING',
        pendingReview: true
      });
      m.seedReview({
        id: 'r-audit',
        tenantId: 'tenant-a',
        quoteId: 'q-audit',
        status: 'ASSIGNED',
        reasonCode: ReviewReasonCode.BLOCKED,
        severity: ReviewSeverity.HIGH,
        assignedToUserId: 'spec-1'
      });

      await service.resolve('r-audit', 'spec-1', 'tenant-a', {
        outcome: ReviewOutcome.CALCULATION_ACCEPTED,
        explanation: 'Validado após análise',
        ruleCodes: ['ICMS-OP-INT', 'PIS-NCL'],
        legalBasisRef: 'LC123_ART23',
        resolutionNotes: 'Conforme legislação'
      });

      const decision = m.mockPrisma.taxReviewDecision.create.mock.calls[0][0].data;
      expect(decision.reasonCode).toBe(ReviewReasonCode.BLOCKED);
      expect(decision.severityAtDecision).toBe(ReviewSeverity.HIGH);
      expect(decision.itemStatusAtDecision).toBe('ASSIGNED');
      expect(decision.createdByUserId).toBe('spec-1');
      expect(decision.ruleCodes).toContain('ICMS-OP-INT');
      expect(decision.legalBasisRef).toBe('LC123_ART23');
    });
  });
});

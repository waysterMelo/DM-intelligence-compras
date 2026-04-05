import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export interface ReviewRecord {
  id: string;
  tenantId: string;
  quoteId: string;
  reason: string;
  severity: string;
  status: string;
  assignedToUserId: string | null;
  resolvedByUserId: string | null;
  oldSnapshotId: string | null;
  newSnapshotId: string | null;
  notes: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
  assignedAt: Date | null;
  resolvedAt: Date | null;
  decisions?: any[];
  quote?: any;
}

@Injectable()
export class TaxReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  // === Criação ===

  async create(data: {
    tenantId: string;
    quoteId: string;
    reason: string;
    severity: string;
    oldSnapshotId?: string | null;
    newSnapshotId?: string | null;
    notes?: string | null;
  }): Promise<string> {
    const item = await this.prisma.taxReviewQueueItem.create({
      data: {
        tenantId: data.tenantId,
        quoteId: data.quoteId,
        reason: data.reason,
        severity: data.severity as any,
        oldSnapshotId: data.oldSnapshotId,
        newSnapshotId: data.newSnapshotId,
        notes: data.notes,
        status: 'OPEN'
      }
    });

    // Marcar quote com pendingReview
    await this.prisma.quote.update({
      where: { id: data.quoteId },
      data: { pendingReview: true }
    });

    return item.id;
  }

  // === Query ===

  async findById(id: string, tenantId: string): Promise<ReviewRecord | null> {
    return this.prisma.taxReviewQueueItem.findFirst({
      where: { id, tenantId },
      include: {
        decisions: true,
        quote: {
          select: {
            id: true,
            supplierName: true,
            price: true,
            taxConfidenceLevel: true,
            taxCalculationStatus: true
          }
        }
      }
    }) as Promise<ReviewRecord | null>;
  }

  async findByQuoteId(quoteId: string, tenantId: string): Promise<ReviewRecord[]> {
    return this.prisma.taxReviewQueueItem.findMany({
      where: { quoteId, tenantId },
      include: { decisions: true },
      orderBy: { createdAt: 'desc' }
    }) as Promise<ReviewRecord[]>;
  }

  async findOpenItems(tenantId: string, limit = 50): Promise<ReviewRecord[]> {
    return this.prisma.taxReviewQueueItem.findMany({
      where: { tenantId, status: { in: ['OPEN', 'ASSIGNED', 'IN_REVIEW'] } },
      include: {
        quote: {
          select: {
            id: true,
            supplierName: true,
            price: true,
            taxConfidenceLevel: true,
            taxCalculationStatus: true
          }
        }
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
      take: limit
    }) as Promise<ReviewRecord[]>;
  }

  async findAssignedTo(userId: string, tenantId: string): Promise<ReviewRecord[]> {
    return this.prisma.taxReviewQueueItem.findMany({
      where: { assignedToUserId: userId, tenantId, status: { in: ['ASSIGNED', 'IN_REVIEW'] } },
      include: { decisions: true },
      orderBy: { createdAt: 'asc' }
    }) as Promise<ReviewRecord[]>;
  }

  async findResolved(tenantId: string, limit = 50): Promise<ReviewRecord[]> {
    return this.prisma.taxReviewQueueItem.findMany({
      where: { tenantId, status: { in: ['RESOLVED', 'DISMISSED'] } },
      include: { decisions: true },
      orderBy: { resolvedAt: 'desc' },
      take: limit
    }) as Promise<ReviewRecord[]>;
  }

  async getStats(tenantId: string): Promise<any> {
    const items = await this.prisma.taxReviewQueueItem.findMany({
      where: { tenantId },
      select: { status: true, severity: true }
    });

    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const item of items) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    }

    return { total: items.length, byStatus, bySeverity };
  }

  // === Ações ===

  async assign(id: string, tenantId: string, assignedToUserId: string): Promise<boolean> {
    const result = await this.prisma.taxReviewQueueItem.updateMany({
      where: { id, tenantId, status: 'OPEN' },
      data: { status: 'ASSIGNED', assignedToUserId, assignedAt: new Date() }
    });
    return result.count > 0;
  }

  async startReview(id: string, tenantId: string): Promise<boolean> {
    const result = await this.prisma.taxReviewQueueItem.updateMany({
      where: { id, tenantId, status: 'ASSIGNED' },
      data: { status: 'IN_REVIEW' }
    });
    return result.count > 0;
  }

  async resolve(id: string, tenantId: string, data: {
    outcome: string;
    resolvedByUserId: string;
    resolutionNotes?: string;
  }): Promise<boolean> {
    const result = await this.prisma.taxReviewQueueItem.updateMany({
      where: { id, tenantId, status: { in: ['ASSIGNED', 'IN_REVIEW'] } },
      data: {
        status: 'RESOLVED',
        resolvedByUserId: data.resolvedByUserId,
        resolvedAt: new Date(),
        resolutionNotes: data.resolutionNotes
      }
    });
    return result.count > 0;
  }

  async dismiss(id: string, tenantId: string, reason?: string): Promise<boolean> {
    const result = await this.prisma.taxReviewQueueItem.updateMany({
      where: { id, tenantId, status: { in: ['OPEN', 'ASSIGNED', 'IN_REVIEW'] } },
      data: { status: 'DISMISSED', resolutionNotes: reason || 'Dismissed by specialist' }
    });
    return result.count > 0;
  }

  async addDecision(data: {
    reviewItemId: string;
    tenantId: string;
    outcome: string;
    adjustedValues?: any;
    explanation?: string;
    ruleCodes?: string[];
    legalBasisRef?: string;
    createdByUserId: string;
  }): Promise<string> {
    const decision = await this.prisma.taxReviewDecision.create({
      data: {
        reviewItemId: data.reviewItemId,
        tenantId: data.tenantId,
        outcome: data.outcome as any,
        adjustedValues: data.adjustedValues,
        explanation: data.explanation,
        ruleCodes: data.ruleCodes || [],
        legalBasisRef: data.legalBasisRef,
        createdByUserId: data.createdByUserId
      }
    });
    return decision.id;
  }

  async clearPendingReviewFlag(quoteId: string): Promise<void> {
    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { pendingReview: false }
    });
  }
}

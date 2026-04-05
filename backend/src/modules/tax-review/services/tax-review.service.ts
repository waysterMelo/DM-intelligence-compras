import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { TaxReviewRepository } from '../repositories/tax-review.repository';
import { CreateReviewDto, AssignReviewDto, ResolveReviewDto, DismissReviewDto } from '../dto/review.dto';
import { PrismaService } from '../../../prisma.service';

/**
 * TaxReviewService — Serviço principal da fila de revisão especializada.
 *
 * Responsabilidades:
 * - Abertura automática de revisão (regras de negócio)
 * - Atribuição a especialistas
 * - Resolução com decisão auditável
 * - Atualização do estado da quote após revisão
 */
@Injectable()
export class TaxReviewService {
  private readonly logger = new Logger(TaxReviewService.name);

  constructor(
    private readonly repo: TaxReviewRepository,
    private readonly prisma: PrismaService
  ) {}

  // === Abertura Automática ===

  /**
   * Abre revisão para uma quote com base em regras automáticas.
   * Chamado pelo motor fiscal quando detecta cenários sensíveis.
   */
  async autoOpen(tenantId: string, dto: CreateReviewDto): Promise<string> {
    // Validar que a quote pertence ao tenant
    const quote = await this.prisma.quote.findFirst({
      where: { id: dto.quoteId }
      // Em produção, adicionar: fornecedor: { tenantId }
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${dto.quoteId} not found.`);
    }

    // Verificar se já existe item aberto para esta quote
    const existing = await this.repo.findByQuoteId(dto.quoteId, tenantId);
    const hasOpen = existing.some(r => ['OPEN', 'ASSIGNED', 'IN_REVIEW'].includes(r.status));
    if (hasOpen) {
      this.logger.log(
        `[ReviewService] Quote ${dto.quoteId} already has open review. Skipping auto-open.`
      );
      return existing.find(r => ['OPEN', 'ASSIGNED', 'IN_REVIEW'].includes(r.status))!.id;
    }

    const id = await this.repo.create({
      tenantId,
      quoteId: dto.quoteId,
      reason: dto.reason,
      severity: dto.severity || 'MEDIUM',
      oldSnapshotId: dto.oldSnapshotId,
      newSnapshotId: dto.newSnapshotId,
      notes: dto.notes
    });

    this.logger.log(
      `[ReviewService] Review ${id} opened for quote ${dto.quoteId}: ${dto.reason} (${dto.severity || 'MEDIUM'})`
    );
    return id;
  }

  // === Listagem ===

  async getOpenItems(tenantId: string, limit?: number) {
    return this.repo.findOpenItems(tenantId, limit);
  }

  async getMyItems(userId: string, tenantId: string) {
    return this.repo.findAssignedTo(userId, tenantId);
  }

  async getResolved(tenantId: string, limit?: number) {
    return this.repo.findResolved(tenantId, limit);
  }

  async getById(id: string, tenantId: string) {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);
    return item;
  }

  async getStats(tenantId: string) {
    return this.repo.getStats(tenantId);
  }

  // === Ações ===

  async assign(id: string, tenantId: string, dto: AssignReviewDto): Promise<boolean> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);
    if (item.status !== 'OPEN') {
      throw new BadRequestException(`Can only assign OPEN items. Current status: ${item.status}`);
    }

    const ok = await this.repo.assign(id, tenantId, dto.assignedToUserId);
    if (!ok) throw new BadRequestException('Failed to assign review item (may have been assigned by another user).');

    this.logger.log(`[ReviewService] Review ${id} assigned to user ${dto.assignedToUserId}`);
    return true;
  }

  async startReview(id: string, userId: string, tenantId: string): Promise<boolean> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);
    if (item.status !== 'ASSIGNED') {
      throw new BadRequestException(`Can only start ASSIGNED items. Current status: ${item.status}`);
    }
    if (item.assignedToUserId !== userId) {
      throw new BadRequestException('This review item is assigned to another user.');
    }

    const ok = await this.repo.startReview(id, tenantId);
    if (!ok) throw new BadRequestException('Failed to start review.');

    this.logger.log(`[ReviewService] Review ${id} started by user ${userId}`);
    return true;
  }

  async resolve(id: string, userId: string, tenantId: string, dto: ResolveReviewDto): Promise<boolean> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);
    if (!['ASSIGNED', 'IN_REVIEW'].includes(item.status)) {
      throw new BadRequestException(`Can only resolve items in ASSIGNED or IN_REVIEW status.`);
    }

    // Criar decisão
    const decisionId = await this.repo.addDecision({
      reviewItemId: id,
      tenantId,
      outcome: dto.outcome,
      adjustedValues: dto.adjustedValues,
      explanation: dto.explanation,
      ruleCodes: dto.ruleCodes,
      legalBasisRef: dto.legalBasisRef,
      createdByUserId: userId
    });

    // Resolver item
    const ok = await this.repo.resolve(id, tenantId, {
      outcome: dto.outcome,
      resolvedByUserId: userId,
      resolutionNotes: dto.resolutionNotes
    });
    if (!ok) throw new BadRequestException('Failed to resolve review item.');

    // Atualizar estado da quote com base no outcome
    await this.updateQuoteState(item.quoteId, dto.outcome);

    this.logger.log(
      `[ReviewService] Review ${id} resolved with outcome ${dto.outcome} by user ${userId}. ` +
      `Decision: ${decisionId}`
    );
    return true;
  }

  async dismiss(id: string, tenantId: string, dto?: DismissReviewDto): Promise<boolean> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);

    const ok = await this.repo.dismiss(id, tenantId, dto?.reason);
    if (!ok) throw new BadRequestException('Failed to dismiss review item.');

    this.logger.log(`[ReviewService] Review ${id} dismissed.`);
    return true;
  }

  // === Atualização do Estado da Quote ===

  private async updateQuoteState(quoteId: string, outcome: string): Promise<void> {
    const updates: any = { pendingReview: false };

    switch (outcome) {
      case 'CALCULATION_ACCEPTED':
        updates.taxConfidenceLevel = 'EXPERT_REVIEWED';
        updates.taxCalculationStatus = 'SUCCESS';
        break;
      case 'CALCULATION_ADJUSTED':
        // Os valores ajustados ficam na decisão; confidence sobe
        updates.taxConfidenceLevel = 'EXPERT_REVIEWED';
        updates.taxCalculationStatus = 'SUCCESS';
        break;
      case 'CALCULATION_REJECTED':
        updates.taxCalculationStatus = 'IN_REVIEW';
        // Confidence não sobe — cálculo foi rejeitado
        break;
      case 'ESCALATED':
        // Mantém pendingReview para ser tratado em nível superior
        updates.pendingReview = true;
        break;
    }

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: updates
    });

    this.logger.log(`[ReviewService] Quote ${quoteId} updated: ${JSON.stringify(updates)}`);
  }
}

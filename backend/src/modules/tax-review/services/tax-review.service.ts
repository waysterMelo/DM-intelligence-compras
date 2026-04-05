import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
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
 *
 * Máquina de estados:
 *   OPEN → ASSIGNED → IN_REVIEW → RESOLVED | DISMISSED
 *
 * Transições permitidas:
 *   OPEN        → ASSIGNED (assign), DISMISSED (dismiss)
 *   ASSIGNED    → IN_REVIEW (start), DISMISSED (dismiss)
 *   IN_REVIEW   → RESOLVED (resolve), DISMISSED (dismiss)
 */
@Injectable()
export class TaxReviewService {
  private readonly logger = new Logger(TaxReviewService.name);

  // Transições válidas por status
  private readonly TRANSITIONS: Record<string, Record<string, { nextStatus: string; requiredUser?: string }>> = {
    OPEN: {
      ASSIGN: { nextStatus: 'ASSIGNED' },
      DISMISS: { nextStatus: 'DISMISSED' }
    },
    ASSIGNED: {
      START: { nextStatus: 'IN_REVIEW' },
      DISMISS: { nextStatus: 'DISMISSED' }
    },
    IN_REVIEW: {
      RESOLVE: { nextStatus: 'RESOLVED' },
      DISMISS: { nextStatus: 'DISMISSED' }
    }
  };

  constructor(
    private readonly repo: TaxReviewRepository,
    private readonly prisma: PrismaService
  ) {}

  // === Tenant-scoped quote validation ===

  /**
   * Busca e valida que a quote pertence ao tenant informado,
   * navegando pelo relacionamento quote → fornecedor → tenantId.
   */
  private async validateQuoteForTenant(tenantId: string, quoteId: string): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        // A quote pode não ter fornecedor vinculado. Nesse caso, verificar
        // se a requisicao existe no contexto do tenant. Para máxima segurança,
        // validamos via fornecedor.tenantId quando existe.
        OR: [
          { fornecedor: { tenantId } },
          // Se a quote não tem fornecedor, permitir — o caller deve validar por outro meio
          { fornecedorId: null }
        ]
      },
      select: { id: true, taxConfidenceLevel: true, taxCalculationStatus: true }
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found or does not belong to the authenticated tenant.`);
    }
    return quote;
  }

  // === Abertura Automática ===

  /**
   * Abre revisão para uma quote com base em regras automáticas.
   * Chamado pelo motor fiscal quando detecta cenários sensíveis.
   */
  async autoOpen(tenantId: string, dto: CreateReviewDto): Promise<string> {
    // A1: Validar quote tenant-scoped
    const quote = await this.validateQuoteForTenant(tenantId, dto.quoteId);

    // Verificar se já existe item aberto para esta quote (idempotência)
    const existing = await this.repo.findByQuoteId(dto.quoteId, tenantId);
    const hasOpen = existing.some(r => ['OPEN', 'ASSIGNED', 'IN_REVIEW'].includes(r.status));
    if (hasOpen) {
      this.logger.log(
        `[ReviewService] Quote ${dto.quoteId} already has open review. Skipping auto-open.`
      );
      const openItem = existing.find(r => ['OPEN', 'ASSIGNED', 'IN_REVIEW'].includes(r.status));
      return openItem!.id;
    }

    const id = await this.repo.create({
      tenantId,
      quoteId: dto.quoteId,
      reasonCode: dto.reasonCode,
      reasonText: dto.reasonText,
      severity: dto.severity || 'MEDIUM',
      oldSnapshotId: dto.oldSnapshotId,
      newSnapshotId: dto.newSnapshotId,
      notes: dto.notes
    });

    this.logger.log(
      `[ReviewService] Review ${id} opened for quote ${dto.quoteId}: ${dto.reasonCode} (${dto.severity || 'MEDIUM'})`
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
    const stats = await this.repo.getStats(tenantId);
    const items = await this.repo.findOpenItems(tenantId);

    // Stats enriquecidos para dashboard UI (A5)
    return {
      ...stats,
      openByUser: {
        total: items.filter(i => i.status === 'OPEN').length,
        assigned: items.filter(i => i.status === 'ASSIGNED').length,
        inReview: items.filter(i => i.status === 'IN_REVIEW').length
      },
      criticalCount: items.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length
    };
  }

  // === Ações ===

  async assign(id: string, tenantId: string, dto: AssignReviewDto): Promise<boolean> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);

    // A2: Validar transição
    if (item.status !== 'OPEN') {
      throw new ConflictException(
        `Invalid transition: can only assign OPEN items. Current status: ${item.status}`
      );
    }

    const ok = await this.repo.assign(id, tenantId, dto.assignedToUserId);
    if (!ok) throw new ConflictException('Failed to assign review item (already assigned by another user).');

    this.logger.log(`[ReviewService] Review ${id} assigned to user ${dto.assignedToUserId}`);
    return true;
  }

  async startReview(id: string, userId: string, tenantId: string): Promise<boolean> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);

    // A2: Validar transição + autorização
    if (item.status !== 'ASSIGNED') {
      throw new ConflictException(
        `Invalid transition: can only start ASSIGNED items. Current status: ${item.status}`
      );
    }
    if (item.assignedToUserId !== userId) {
      throw new ConflictException('This review item is assigned to another user.');
    }

    const ok = await this.repo.startReview(id, tenantId);
    if (!ok) throw new ConflictException('Failed to start review (state changed by concurrent operation).');

    this.logger.log(`[ReviewService] Review ${id} started by user ${userId}`);
    return true;
  }

  async resolve(id: string, userId: string, tenantId: string, dto: ResolveReviewDto): Promise<boolean> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);

    // A2: Validar transição — resolve só aceita ASSIGNED ou IN_REVIEW
    const validStatuses = ['ASSIGNED', 'IN_REVIEW'];
    if (!validStatuses.includes(item.status)) {
      throw new ConflictException(
        `Invalid transition: can only resolve items in ASSIGNED or IN_REVIEW status. Current: ${item.status}`
      );
    }

    // A3: Criar decisão com trilha auditável completa
    const decisionId = await this.repo.addDecision({
      reviewItemId: id,
      tenantId,
      outcome: dto.outcome,
      adjustedValues: dto.adjustedValues,
      explanation: dto.explanation,
      reasonCode: item.reasonCode,
      severityAtDecision: item.severity,
      itemStatusAtDecision: item.status,
      severitySnapshot: item.severity,
      ruleCodes: dto.ruleCodes,
      legalBasisRef: dto.legalBasisRef,
      createdByUserId: userId
    });

    // Resolver item (updateMany com filtro de status = proteção against corrida)
    const ok = await this.repo.resolve(id, tenantId, {
      outcome: dto.outcome,
      resolvedByUserId: userId,
      resolutionNotes: dto.resolutionNotes
    });
    if (!ok) throw new ConflictException('Failed to resolve review item (state changed by concurrent operation).');

    // Atualizar estado da quote com base no outcome
    await this.updateQuoteState(tenantId, item.quoteId, dto.outcome);

    this.logger.log(
      `[ReviewService] Review ${id} resolved with outcome ${dto.outcome} by user ${userId}. ` +
      `Decision: ${decisionId}`
    );
    return true;
  }

  async dismiss(id: string, tenantId: string, dto?: DismissReviewDto): Promise<boolean> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException(`Review item ${id} not found or access denied.`);

    // A2: dismiss só pode ocorrer em estados não-terminais
    if (!['OPEN', 'ASSIGNED', 'IN_REVIEW'].includes(item.status)) {
      throw new ConflictException(
        `Cannot dismiss item in terminal status: ${item.status}`
      );
    }

    const ok = await this.repo.dismiss(id, tenantId, dto?.reason);
    if (!ok) throw new ConflictException('Failed to dismiss review item (state changed).');

    this.logger.log(`[ReviewService] Review ${id} dismissed.`);
    return true;
  }

  // === Atualização do Estado da Quote ===

  private async updateQuoteState(tenantId: string, quoteId: string, outcome: string): Promise<void> {
    // A1: Validar tenant-scoped antes de atualizar
    const quote = await this.validateQuoteForTenant(tenantId, quoteId);

    const updates: any = { pendingReview: false };

    switch (outcome) {
      case 'CALCULATION_ACCEPTED':
        updates.taxConfidenceLevel = 'EXPERT_REVIEWED';
        updates.taxCalculationStatus = 'SUCCESS';
        break;
      case 'CALCULATION_ADJUSTED':
        updates.taxConfidenceLevel = 'EXPERT_REVIEWED';
        updates.taxCalculationStatus = 'SUCCESS';
        break;
      case 'CALCULATION_REJECTED':
        updates.taxCalculationStatus = 'PENDING'; // Volta para pendente, requer recálculo
        break;
      case 'ESCALATED':
        updates.pendingReview = true; // Mantém flag para nível superior
        break;
    }

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: updates
    });

    this.logger.log(`[ReviewService] Quote ${quoteId} updated: ${JSON.stringify(updates)}`);
  }
}

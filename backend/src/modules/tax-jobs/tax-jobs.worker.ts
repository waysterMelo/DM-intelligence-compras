import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { TaxEngineService } from '../tax-engine/services/tax-engine.service';
import { TaxHashUtil } from '../tax-engine/utils/tax-hash.util';
import { CalculateQuoteTaxDto } from '../tax-engine/dto/calculate-quote-tax.dto';
import { TAX_ENGINE_VERSION } from '../tax-engine/controllers/tax-engine.controller';

@Injectable()
export class TaxJobsWorker {
  private readonly logger = new Logger(TaxJobsWorker.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly taxEngineService: TaxEngineService
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.processNextJob();
    } catch (e: any) {
      this.logger.error(`Error in TaxJobsWorker: ${e.message}`, e.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processNextJob() {
    // Busca algum Job QUEUED
    const job = await this.prisma.taxReprocessingJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' }
    });

    if (!job) {
      // Tenta achar um rodando parcial (onde o node possa ter caído)
      // Para simular, ignorar por agora e focar nos QUEUED ou RUNNING
      return;
    }

    // Trava (Lock)
    const lock = await this.prisma.taxReprocessingJob.updateMany({
      where: { id: job.id, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date() }
    });

    if (lock.count === 0) return; // Algum outro worker pegou

    this.logger.log(`[Worker] Started processing Job ${job.id}`);

    // Pega itens PENDING em batches curtos (ex: 50 pra não travar Main Thread)
    while (true) {
      // Verifica se o usuário não cancelou
      const checkJob = await this.prisma.taxReprocessingJob.findUnique({ where: { id: job.id } });
      if (!checkJob || checkJob.status === 'CANCELED') break;

      const items = await this.prisma.taxReprocessingJobItem.findMany({
        where: { jobId: job.id, status: 'PENDING' },
        take: 10
      });

      if (items.length === 0) break; // Finished all items

      let processed = 0;
      let skipped = 0;
      let failed = 0;

      for (const item of items) {
        await this.prisma.taxReprocessingJobItem.update({
          where: { id: item.id },
          data: { startedAt: new Date() }
        });

        try {
          // 1. Busca a Quote Core
          const quote = await this.prisma.quote.findUnique({
            where: { id: item.quoteId },
            include: { requisition: true, fornecedor: true }
          });

          if (!quote || !quote.fornecedorId) {
            throw new Error(`Quote ${item.quoteId} ou Fornecedor Inexistente`);
          }

          // Descobre o BuyerId (Tenant / Dummy)
          const buyer = await this.prisma.fornecedor.findFirst({ where: { companyRole: 'BUYER' } });
          if (!buyer) throw new Error('Empresa Compradora (Tenant) não configurada');

          // Monta Input
          const dto: CalculateQuoteTaxDto = {
            buyerCompanyId: buyer.id,
            supplierCompanyId: quote.fornecedorId,
            item: {
              quantity: quote.requisition.quantity,
              unitPrice: quote.price,
              totalFreight: quote.freight || 0,
              itemUseType: quote.itemUseType as any,
              creditNature: quote.creditNature as any,
              operationType: quote.operationType as any,
              ipiRate: quote.ipiRate || 0,
              icmsRate: quote.icmsRate || 0,
              pisRate: quote.pisRate || 0,
              cofinsRate: quote.cofinsRate || 0,
              hasIcmsSt: quote.hasIcmsSt || false
            }
          };

          // Gera Novo Hash
          const newHashMeta = TaxHashUtil.generateDeterministicHash(dto);
          const newHash = newHashMeta.hash;
          const oldSnapshotId = quote.lastTaxSnapshotId;

          // Busca Hash Antigo
          let oldInputHash: string | null = null;
          if (oldSnapshotId) {
             const oldSnap = await this.prisma.quoteTaxSnapshot.findUnique({ where: { id: oldSnapshotId }, select: { inputHash: true } });
             if (oldSnap) oldInputHash = oldSnap.inputHash;
          }

          // 2. Hash Igual? Pula.
          if (oldInputHash === newHash) {
             await this.prisma.taxReprocessingJobItem.update({
               where: { id: item.id },
               data: {
                 status: 'SKIPPED',
                 skipReason: 'INPUT_HASH_UNCHANGED',
                 oldSnapshotId,
                 oldInputHash,
                 newInputHash: newHash,
                 finishedAt: new Date()
               }
             });
             skipped++;
             continue; // Próximo item do for loop
          }

          // 3. Hash Mudou! Calcula.
          const result = await this.taxEngineService.calculate(dto);
          const newSnap = await this.taxEngineService.saveSnapshot(quote.id, result, TAX_ENGINE_VERSION, dto);

          await this.prisma.taxReprocessingJobItem.update({
             where: { id: item.id },
             data: {
               status: 'PROCESSED',
               oldSnapshotId,
               newSnapshotId: newSnap.id,
               oldInputHash,
               newInputHash: newHash,
               finishedAt: new Date()
             }
          });
          processed++;

        } catch (e: any) {
          await this.prisma.taxReprocessingJobItem.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              errorMessage: e.message || 'Unknown error',
              finishedAt: new Date()
            }
          });
          failed++;
        }
      }

      // Atualiza Status do Job por Batch
      await this.prisma.taxReprocessingJob.update({
        where: { id: job.id },
        data: {
          processedItems: { increment: processed },
          skippedItems: { increment: skipped },
          failedItems: { increment: failed }
        }
      });
    }

    // Marca Job como Feito
    const finalJob = await this.prisma.taxReprocessingJob.findUnique({ where: { id: job.id } });
    if (finalJob && finalJob.status === 'RUNNING') {
      const isFailed = finalJob.failedItems > 0 && finalJob.processedItems === 0;
      const isPartial = finalJob.failedItems > 0 && finalJob.processedItems > 0;
      
      const setStatus = isFailed ? 'FAILED' : (isPartial ? 'PARTIAL' : 'COMPLETED');
      
      await this.prisma.taxReprocessingJob.update({
        where: { id: job.id },
        data: {
          status: setStatus,
          finishedAt: new Date()
        }
      });

      this.logger.log(`[Worker] Job ${job.id} concluded with status ${setStatus}.`);
    }
  }
}

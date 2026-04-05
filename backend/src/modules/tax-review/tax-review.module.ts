import { Module } from '@nestjs/common';
import { TaxReviewController } from './tax-review.controller';
import { TaxReviewService } from './services/tax-review.service';
import { TaxReviewAutoService } from './services/tax-review-auto.service';
import { TaxReviewRepository } from './repositories/tax-review.repository';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TaxReviewController],
  providers: [PrismaService, TaxReviewRepository, TaxReviewService, TaxReviewAutoService],
  exports: [TaxReviewService, TaxReviewAutoService, TaxReviewRepository]
})
export class TaxReviewModule {}

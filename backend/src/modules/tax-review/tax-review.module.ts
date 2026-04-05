import { Module } from '@nestjs/common';
import { TaxReviewController } from './tax-review.controller';
import { TaxReviewService } from './services/tax-review.service';
import { TaxReviewRepository } from './repositories/tax-review.repository';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TaxReviewController],
  providers: [PrismaService, TaxReviewRepository, TaxReviewService],
  exports: [TaxReviewService]
})
export class TaxReviewModule {}

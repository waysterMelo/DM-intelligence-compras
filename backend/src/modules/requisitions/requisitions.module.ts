import { Module } from '@nestjs/common';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { PrismaService } from '../../prisma.service';
import { TaxCreditModule } from '../tax-engine/tax-credit.module';

@Module({
  imports: [TaxCreditModule],
  controllers: [RequisitionsController],
  providers: [RequisitionsService, PrismaService],
})
export class RequisitionsModule {}

import { Module } from '@nestjs/common';
import { TaxGovernanceController } from './tax-governance.controller';
import { TaxGovernanceService } from './tax-governance.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [TaxGovernanceController],
  providers: [TaxGovernanceService, PrismaService],
})
export class TaxGovernanceModule {}

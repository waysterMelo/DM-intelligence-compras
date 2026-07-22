import { Controller, Get, Param } from '@nestjs/common';
import { TaxGovernanceService } from './tax-governance.service';

@Controller('tax-governance')
export class TaxGovernanceController {
  constructor(private readonly taxGovernanceService: TaxGovernanceService) {}

  @Get('rules')
  async listRules() {
    return this.taxGovernanceService.findAllRules();
  }

  @Get('audit/compare/:idA/:idB')
  async compareSnapshots(@Param('idA') idA: string, @Param('idB') idB: string) {
    return this.taxGovernanceService.compareSnapshots(idA, idB);
  }
}

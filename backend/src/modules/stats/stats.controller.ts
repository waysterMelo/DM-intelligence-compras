import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';

// Este controller responderá por http://localhost:3000/stats

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  async getStats() {
    return this.statsService.getDashboardStats();
  }
}

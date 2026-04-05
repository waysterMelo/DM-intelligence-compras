import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
  UseGuards,
  Req,
  Request
} from '@nestjs/common';
import { TaxReviewService } from './services/tax-review.service';
import { CreateReviewDto, AssignReviewDto, ResolveReviewDto, DismissReviewDto } from './dto/review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

interface AuthenticatedRequest extends Request {
  user: { userId: string; username: string; role: string; tenantId?: string };
}

@Controller('tax-governance/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxReviewController {
  constructor(private readonly reviewService: TaxReviewService) {}

  // === Abertura Automática (chamado pelo motor ou manualmente) ===

  @Post()
  @Roles('ADMIN', 'MANAGER', 'SPECIALIST')
  async openReview(@Body() dto: CreateReviewDto, @Req() req: AuthenticatedRequest) {
    const tenantId = dto['tenantId'] || req.user.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required.');
    }

    const id = await this.reviewService.autoOpen(tenantId, dto);
    return { success: true, reviewId: id, message: 'Review item opened.' };
  }

  // === Listagem ===

  @Get('open')
  async getOpenItems(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.reviewService.getOpenItems(req.user.tenantId!, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('my')
  async getMyItems(@Req() req: AuthenticatedRequest) {
    return this.reviewService.getMyItems(req.user.userId, req.user.tenantId!);
  }

  @Get('resolved')
  async getResolved(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.reviewService.getResolved(req.user.tenantId!, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('stats')
  async getStats(@Req() req: AuthenticatedRequest) {
    return this.reviewService.getStats(req.user.tenantId!);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.reviewService.getById(id, req.user.tenantId!);
  }

  // === Ações ===

  @Post(':id/assign')
  @Roles('ADMIN', 'MANAGER')
  async assign(@Param('id') id: string, @Body() dto: AssignReviewDto, @Req() req: AuthenticatedRequest) {
    await this.reviewService.assign(id, req.user.tenantId!, dto);
    return { success: true, message: `Review ${id} assigned to ${dto.assignedToUserId}` };
  }

  @Post(':id/start')
  @Roles('SPECIALIST', 'ADMIN')
  async startReview(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.reviewService.startReview(id, req.user.userId, req.user.tenantId!);
    return { success: true, message: `Review ${id} started.` };
  }

  @Post(':id/resolve')
  @Roles('SPECIALIST', 'ADMIN')
  async resolve(@Param('id') id: string, @Body() dto: ResolveReviewDto, @Req() req: AuthenticatedRequest) {
    await this.reviewService.resolve(id, req.user.userId, req.user.tenantId!, dto);
    return { success: true, message: `Review ${id} resolved with outcome ${dto.outcome}` };
  }

  @Post(':id/dismiss')
  @Roles('SPECIALIST', 'ADMIN', 'MANAGER')
  async dismiss(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Body() dto?: DismissReviewDto) {
    await this.reviewService.dismiss(id, req.user.tenantId!, dto);
    return { success: true, message: `Review ${id} dismissed.` };
  }
}

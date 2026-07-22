import { Body, Controller, Post } from '@nestjs/common';
import { TcoInput, TcoService } from './tco.service';

@Controller('tco')
export class TcoController {
  constructor(private readonly tcoService: TcoService) {}

  @Post('preview')
  preview(@Body() input: TcoInput) {
    return this.tcoService.preview(input);
  }
}

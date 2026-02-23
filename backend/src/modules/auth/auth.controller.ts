import { Controller, Request, Post, UseGuards, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() req) {
    // Validate user credentials via AuthService -> UsersService
    const user = await this.authService.validateUser(req.username, req.password);
    if (!user) {
        throw new Error('Unauthorized');
    }
    return this.authService.login(user);
  }
}

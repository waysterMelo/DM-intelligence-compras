import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.usersService.login(body.username, body.password);
  }
}

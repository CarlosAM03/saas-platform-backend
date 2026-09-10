import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { AuthService } from './auth.service';
import { LoginRequest } from './dto/login.request';
import { SelectTenantRequest } from './dto/select-tenant.request';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() request: LoginRequest) {
    return this.authService
      .validateUser(request.email, request.password)
      .then((user) => this.authService.login(user));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() request: AuthenticatedRequest) {
    this.authService.logout(request.user.id);
    return {};
  }

  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  selectTenant(
    @Req() request: AuthenticatedRequest,
    @Body() body: SelectTenantRequest,
  ) {
    return this.authService.selectTenant(request.user.id, body.tenantId);
  }

  @Get('me')
  getMe(@CurrentUser() user: { id: string }, @Req() request: Request) {
    return this.authService.getMe(
      user.id,
      request.headers.authorization!.split(' ')[1],
    );
  }
}

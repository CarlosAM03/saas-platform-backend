import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { AuthService } from './auth.service';
import { LoginRequest } from './dto/login.request';
import { SelectTenantRequest } from './dto/select-tenant.request';
import { Roles } from 'src/common/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login')
  login(@Body() request: LoginRequest) {
    return this.authService
      .validateUser(request.email, request.password)
      .then((user) => this.authService.login(user));
  }

  @Post('logout')
  @UseGuards(RateLimitGuard)
  logout(@Req() request: AuthenticatedRequest) {
    this.authService.logout(request.user.id);
    return { message: 'Logout successful' };
  }

  @Post('select-tenant')
  @UseGuards(RateLimitGuard)
  selectTenant(
    @Req() request: AuthenticatedRequest,
    @Body() body: SelectTenantRequest,
  ) {
    return this.authService.selectTenant(request.user.id, body.tenantId);
  }

  @Get('me')
  @Roles('ADMIN', 'OWNER', 'MEMBER')
  getMe(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }
}

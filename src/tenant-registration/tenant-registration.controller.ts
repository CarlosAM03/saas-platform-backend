import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { RegisterTenantRequest } from './registration.dto';
import { TenantRegistrationService } from './tenant-registration.service';

@Controller('tenants')
@Roles('ADMIN')
export class TenantRegistrationController {
  constructor(private readonly registration: TenantRegistrationService) {}
  @Post('register')
  register(@Body() dto: RegisterTenantRequest) {
    return this.registration.register(dto);
  }

  @Get(':id/onboarding')
  get(@Param('id') id: string) {
    return this.registration.get(id);
  }

  @Post(':id/resend-welcome')
  @HttpCode(200)
  resend(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    if (
      Number(req.headers['content-length'] ?? 0) > 0 ||
      req.headers['transfer-encoding'] ||
      (body !== undefined &&
        body !== null &&
        (typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).length))
    )
      throw new BadRequestException('This operation accepts no body');
    return this.registration.resend(id);
  }
}

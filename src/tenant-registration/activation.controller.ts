import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ActivationService } from './activation.service';
import { ActivationRateLimitGuard } from './activation-rate-limit.guard';
import { CompleteRequest, RedeemRequest } from './registration.dto';

@Controller('auth')
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}
  @Public()
  @Post('redeem-first-access')
  @HttpCode(200)
  @UseGuards(ActivationRateLimitGuard)
  redeem(@Body() dto: RedeemRequest) {
    return this.activation.redeem(dto.activationToken);
  }

  @Public()
  @Post('complete-first-access')
  @HttpCode(200)
  @UseGuards(ActivationRateLimitGuard)
  complete(@Body() dto: CompleteRequest) {
    return this.activation.complete(dto.firstAccessToken, dto.newPassword);
  }
}

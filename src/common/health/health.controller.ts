import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  getHealth() {
    return { status: 'ok' };
  }

  @Public()
  @Get('live')
  getLiveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  getReadiness() {
    return this.health.readiness();
  }
}

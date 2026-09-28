import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';

@Module({
  imports: [CommonModule, PrismaModule],
  controllers: [ProspectsController],
  providers: [ProspectsService],
  exports: [ProspectsService],
})
export class ProspectsModule {}

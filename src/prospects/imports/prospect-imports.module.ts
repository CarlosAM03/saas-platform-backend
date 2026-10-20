import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProspectImportsController } from './prospect-imports.controller';
import { ProspectImportsService } from './prospect-imports.service';
import { ProspectCsvParser } from './prospect-csv.parser';

@Module({
  imports: [CommonModule, PrismaModule, ConfigModule],
  controllers: [ProspectImportsController],
  providers: [ProspectImportsService, ProspectCsvParser],
})
export class ProspectImportsModule {}

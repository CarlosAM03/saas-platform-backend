import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Header,
  Headers,
  HttpCode,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { CommonModule } from '../common/common.module';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaModule } from '../prisma/prisma.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { BatchAdministrationService } from './batch-administration.service';
import {
  BatchCallbackDto,
  BatchExportDto,
  BatchListDto,
  ConfirmSnapshotDto,
  CreateBatchDto,
} from './batch.dto';
import { BatchRuntime } from './batch-runtime';

@ApiTags('Prospecting batches')
@Controller('prospecting-batches')
@Roles('ADMIN', 'OWNER')
class BatchController {
  constructor(private readonly service: BatchAdministrationService) {}

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Register a batch for the selected campaign' })
  create(
    @Body() input: CreateBatchDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.create(input, key);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: BatchListDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read a batch owned by the active user' })
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Post(':id/reconcile')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  reconcile(@Param('id') id: string) {
    return this.service.reconcile(id);
  }

  @Get(':id/jobs/:jobId/results')
  @Header('Cache-Control', 'no-store')
  results(@Param('id') id: string, @Param('jobId') jobId: string) {
    return this.service.preview(id, jobId);
  }

  @Get(':id/jobs/:jobId/export')
  async export(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Query() query: BatchExportDto,
    @Res() response: Response,
  ) {
    const download = await this.service.export(id, jobId, query.format);
    response.set({
      'Cache-Control': 'no-store',
      'Content-Type': download.headers.get('content-type')!,
      'Content-Disposition': `attachment; filename="prospectos.${query.format}"`,
    });
    await pipeline(
      Readable.fromWeb(download.body! as ReadableStream<Uint8Array>),
      response,
    );
  }

  @Post(':id/jobs/:jobId/confirm')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  confirm(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() input: ConfirmSnapshotDto,
  ) {
    return this.service.confirm(id, jobId, input);
  }

  @Post(':id/jobs/:jobId/confirmations/:snapshotId/settle')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  settle(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    return this.service.settleSnapshot(id, jobId, snapshotId);
  }
}

@Injectable()
class BatchCallbackGuard implements CanActivate {
  constructor(private readonly runtime: BatchRuntime) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    this.runtime.authorizeCallback(request.get('X-API-Key'));
    return true;
  }
}

@ApiExcludeController()
@Public()
@UseGuards(BatchCallbackGuard)
@Controller('internal/prospecting-batches')
class BatchCallbackController {
  constructor(
    private readonly service: BatchAdministrationService,
    private readonly runtime: BatchRuntime,
  ) {}

  @Post(':batchId/jobs/:jobId/events')
  @HttpCode(200)
  receive(
    @Param('batchId') batchId: string,
    @Param('jobId') jobId: string,
    @Body() event: BatchCallbackDto,
  ) {
    return this.service.receive(
      this.runtime.connect().solutionId,
      batchId,
      jobId,
      event,
    );
  }
}

@Module({
  imports: [ConfigModule, PrismaModule, CommonModule, ProspectsModule],
  controllers: [BatchController, BatchCallbackController],
  providers: [BatchAdministrationService, BatchRuntime, BatchCallbackGuard],
})
export class BatchModule {}

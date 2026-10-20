import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CSV_MAX_BYTES } from './prospect-csv.parser';
import {
  ConfirmProspectImportRequest,
  PreviewProspectImportRequest,
} from './dto/prospect-import.request';
import { ProspectImportsService } from './prospect-imports.service';

@Controller('prospects/import')
@Roles('ADMIN', 'OWNER')
export class ProspectImportsController {
  constructor(private readonly service: ProspectImportsService) {}

  @Post('preview')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: CSV_MAX_BYTES,
        files: 1,
        fields: 1,
        fieldSize: 100000,
      },
    }),
  )
  preview(
    @Body() request: PreviewProspectImportRequest,
    @UploadedFile() file?: { buffer: Buffer; originalname: string },
  ) {
    return this.service.preview(request.campaignId, this.file(file));
  }

  @Post('confirm')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: CSV_MAX_BYTES,
        files: 1,
        fields: 3,
        fieldSize: 100000,
      },
    }),
  )
  confirm(
    @Body() request: ConfirmProspectImportRequest,
    @UploadedFile() file?: { buffer: Buffer; originalname: string },
  ) {
    return this.service.confirm(
      request.campaignId,
      this.file(file),
      request.previewReference,
      request.decisions,
    );
  }

  private file(file?: { buffer: Buffer; originalname: string }): Buffer {
    if (!file?.buffer || /\.xlsx?$/i.test(file.originalname))
      throw new BadRequestException(
        'A CSV file is required; Excel files are not supported',
      );
    return file.buffer;
  }
}

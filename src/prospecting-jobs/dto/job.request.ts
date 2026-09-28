import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { PickType } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ProspectingQueryRequest {
  @IsString() keyword!: string;
  @IsString() location!: string;
  @IsIn(['google_maps']) source!: 'google_maps';
  @IsInt() @Min(1) limit!: number;
}

export class CreateJobRequest {
  @Matches(/^c[a-z0-9]{20,}$/) campaignId!: string;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ProspectingQueryRequest)
  query!: ProspectingQueryRequest;
}

export class JobListQuery extends PickType(PaginationDto, [
  'page',
  'limit',
  'sortOrder',
] as const) {
  @IsIn(['createdAt', 'updatedAt', 'startedAt', 'completedAt', 'status', 'id'])
  sortBy = 'createdAt';
}

export class JobExportQuery {
  @IsIn(['csv', 'xlsx']) format!: 'csv' | 'xlsx';
}

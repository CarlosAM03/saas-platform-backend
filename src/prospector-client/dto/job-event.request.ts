import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export class BusinessResult {
  @IsString() name!: string;
  @IsIn(['google_maps']) source!: 'google_maps';
  @IsOptional() @IsString() category?: string | null;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsUrl({ require_protocol: true }) website?: string | null;
  @IsOptional() @IsString() sourceIdentifier?: string | null;
  @IsOptional() @IsString() language?: string | null;
  @IsOptional() @IsObject() metadata?: { [key: string]: JsonValue } | null;
}

export class PipelineProgress {
  @IsIn(['google_maps']) source!: 'google_maps';
  @IsString() stage!: string;
  @IsString() message!: string;
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  percentage!: number;
}

export class JobEventError {
  @IsString() code!: string;
  @IsString() message!: string;
}

export class JobEventRequest {
  @IsUUID() eventId!: string;
  @Matches(/^c[a-z0-9]{20,}$/) jobId!: string;
  @IsInt() @Min(1) sequence!: number;
  @IsIn(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
  status!: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
  timestamp!: string;

  // These fields are required but may explicitly be null.
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PipelineProgress)
  progress!: PipelineProgress | null;

  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessResult)
  results!: BusinessResult[] | null;

  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => JobEventError)
  error!: JobEventError | null;
}

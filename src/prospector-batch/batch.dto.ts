import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BatchJobState,
  BatchResultAvailability,
  BatchResultQuality,
} from '@prisma/client';

export const privateCuid = /^c[a-z0-9]{20,127}$/u;
const dateTime = /T.*(?:Z|[+-]\d{2}:\d{2})$/u;

class BatchQueryDto {
  @Equals('google_maps')
  source!: 'google_maps';

  @IsString()
  @Matches(/\S/u)
  keyword!: string;

  @IsString()
  @Matches(/\S/u)
  location!: string;

  @IsInt()
  @Min(1)
  @Max(150)
  limit!: number;
}

export class CreateBatchDto {
  @IsString()
  @MaxLength(128)
  @Matches(privateCuid)
  campaignId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => BatchQueryDto)
  queries!: BatchQueryDto[];
}

export enum EventKind {
  STATE_CHANGED = 'STATE_CHANGED',
  PROGRESS = 'PROGRESS',
  TERMINAL = 'TERMINAL',
  RESULT_AVAILABILITY_CHANGED = 'RESULT_AVAILABILITY_CHANGED',
}

class CallbackErrorDto {
  @IsString()
  code!: string;

  @IsString()
  message!: string;
}

export class BatchCallbackDto {
  @Equals('1.0')
  schemaVersion!: '1.0';

  @IsUUID()
  eventId!: string;

  @Matches(privateCuid)
  batchId!: string;

  @Matches(privateCuid)
  jobId!: string;

  @IsInt()
  @Min(0)
  @Max(4)
  queryIndex!: number;

  @IsEnum(BatchJobState)
  status!: BatchJobState;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  sequence!: number;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(dateTime)
  timestamp!: string;

  @IsEnum(EventKind)
  kind!: EventKind;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsObject()
  progress?: Record<string, unknown>;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsEnum(BatchResultQuality)
  quality?: BatchResultQuality;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsEnum(BatchResultAvailability)
  availability?: BatchResultAvailability;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsUUID()
  snapshotId?: string;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(dateTime)
  expiresAt?: string;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CallbackErrorDto)
  error?: CallbackErrorDto;
}

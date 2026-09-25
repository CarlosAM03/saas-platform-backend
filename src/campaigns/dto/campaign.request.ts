import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateCampaignRequest {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

export class UpdateCampaignRequest {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['ACTIVA', 'PAUSADA', 'COMPLETADA', 'ARCHIVADA'])
  status?: 'ACTIVA' | 'PAUSADA' | 'COMPLETADA' | 'ARCHIVADA';
}

export class DeleteCampaignQuery {
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  permanent = false;
}

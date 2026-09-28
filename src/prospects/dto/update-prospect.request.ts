import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export class UpdateProspectRequest {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  website?: string | null;

  @IsOptional()
  @IsString()
  language?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

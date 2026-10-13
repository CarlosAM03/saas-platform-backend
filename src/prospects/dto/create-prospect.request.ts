import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateProspectRequest {
  @IsString()
@Matches(/^\S+$/, {
  message: 'campaignId debe ser un identificador no vacío y sin espacios',
})
campaignId!: string;

  @IsString()
  @Matches(/\S/, {
    message: 'name no puede estar vacío ni contener solamente espacios',
  })
  name!: string;

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
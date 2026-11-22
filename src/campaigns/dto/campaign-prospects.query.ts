import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CampaignProspectsQuery extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsIn([
    'SIN_GESTIONAR',
    'EN_INVESTIGACION',
    'CONTACTADO',
    'EN_SEGUIMIENTO',
    'OPORTUNIDAD',
    'CERRADO',
  ])
  stage?: string;

  @IsOptional()
  @IsIn(['SIN_EVALUAR', 'APTO', 'NO_APTO'])
  evaluation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  responsibleId?: string;
}

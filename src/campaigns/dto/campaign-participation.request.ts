import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateStageRequest {
  @IsIn([
    'SIN_GESTIONAR',
    'EN_INVESTIGACION',
    'CONTACTADO',
    'EN_SEGUIMIENTO',
    'OPORTUNIDAD',
    'CERRADO',
  ])
  stage!: string;
}

export class UpdateEvaluationRequest {
  @IsIn(['SIN_EVALUAR', 'APTO', 'NO_APTO'])
  evaluation!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AssignResponsibleRequest {
  @IsString()
  @Matches(/\S/)
  @MaxLength(128)
  responsibleId!: string;
}

export class CreateCampaignActivityRequest {
  @IsIn(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'OTHER'])
  type!: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsString()
  declaredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  correctsId?: string;
}

import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
  ValidationArguments,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// Explicit timezone is mandatory: date-only and local timestamps are ambiguous.
const timestampWithOffset =
  /T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function OrderedRange(from: string): PropertyDecorator {
  return ValidateBy({
    name: 'orderedRange',
    validator: {
      validate(value: string, args: ValidationArguments) {
        const lower = (args.object as Record<string, unknown>)[from];
        return (
          lower === undefined ||
          (typeof lower === 'string' && Date.parse(lower) <= Date.parse(value))
        );
      },
      defaultMessage: () => `Range end must be at or after ${from}`,
    },
  });
}

export class CampaignProspectsQuery extends PaginationDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(timestampWithOffset)
  addedFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(timestampWithOffset)
  @OrderedRange('addedFrom')
  addedTo?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(timestampWithOffset)
  activityFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(timestampWithOffset)
  @OrderedRange('activityFrom')
  activityTo?: string;

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

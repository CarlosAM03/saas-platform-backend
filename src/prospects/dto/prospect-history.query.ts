import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

// Contextual collections have fixed ordering, not the master list's sort fields.
export class ProspectHistoryQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

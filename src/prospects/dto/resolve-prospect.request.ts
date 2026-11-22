import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CreateProspectRequest } from './create-prospect.request';

export class ResolveProspectRequest extends CreateProspectRequest {
  @IsIn(['CREATE', 'LINK_EXISTING', 'SKIP'])
  resolution!: 'CREATE' | 'LINK_EXISTING' | 'SKIP';

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(128)
  candidateId?: string;
}

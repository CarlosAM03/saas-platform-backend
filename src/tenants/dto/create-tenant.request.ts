import { IsString } from 'class-validator';

export class CreateTenantRequest {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;
}

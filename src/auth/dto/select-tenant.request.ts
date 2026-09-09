import { IsString, MinLength } from 'class-validator';

export class SelectTenantRequest {
  @IsString()
  @MinLength(6)
  tenantId!: string;

  constructor(tenantId = '') {
    this.tenantId = tenantId;
  }
}

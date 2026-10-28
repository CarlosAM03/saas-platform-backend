import { Transform } from 'class-transformer';
import { transformEmail } from '../common/validation/normalize-email';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class RegisterTenantRequest {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  tenantName!: string;
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/)
  tenantSlug!: string;
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  ownerName!: string;
  @Transform(transformEmail)
  @IsEmail()
  @MaxLength(254)
  ownerEmail!: string;
}
export class RedeemRequest {
  @IsString() @MinLength(40) activationToken!: string;
}
export class CompleteRequest {
  @IsString() @MinLength(1) firstAccessToken!: string;
  @IsString() @MinLength(10) newPassword!: string;
}

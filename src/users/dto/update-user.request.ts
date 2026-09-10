import {
  IsEmail,
  IsEnum,
  ValidateIf,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

const passwordPattern = /^(?=.*\p{L})(?=.*\p{N})(?=.*[^\p{L}\p{N}]).+$/u;

export class UpdateUserRequest {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEmail()
  email?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(10)
  @Matches(passwordPattern, {
    message:
      'Password must contain a letter, a number, and a special character',
  })
  password?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  roleId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(UserStatus)
  status?: UserStatus;
}

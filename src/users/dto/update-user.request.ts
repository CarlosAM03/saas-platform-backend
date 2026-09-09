import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

const passwordPattern = /^(?=.*\p{L})(?=.*\p{N})(?=.*[^\p{L}\p{N}]).+$/u;

export class UpdateUserRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @Matches(passwordPattern, {
    message:
      'Password must contain a letter, a number, and a special character',
  })
  password?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

import {
  IsEmail,
  ValidateIf,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

const passwordPattern = /^(?=.*\p{L})(?=.*\p{N})(?=.*[^\p{L}\p{N}]).+$/u;

export class CreateUserRequest {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @Matches(passwordPattern, {
    message:
      'Password must contain a letter, a number, and a special character',
  })
  password!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  roleId?: string;
}

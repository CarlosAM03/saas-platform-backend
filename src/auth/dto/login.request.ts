import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { transformEmail } from '../../common/validation/normalize-email';

export class LoginRequest {
  @Transform(transformEmail)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  constructor(email = '', password = '') {
    this.email = email;
    this.password = password;
  }
}

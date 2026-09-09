import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginRequest {
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

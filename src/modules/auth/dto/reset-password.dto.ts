import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  phone: string;

  @IsString()
  @IsNotEmpty()
  smsCode: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;
}

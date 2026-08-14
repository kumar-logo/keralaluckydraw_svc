import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  phone: string;

  @IsOptional()
  @IsString()
  smsCode?: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}

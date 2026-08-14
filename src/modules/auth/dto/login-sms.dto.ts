import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class LoginSmsDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  phone: string;

  @IsOptional()
  @IsString()
  smsCode?: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}

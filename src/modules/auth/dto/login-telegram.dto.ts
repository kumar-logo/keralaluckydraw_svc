import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginTelegramDto {
  @IsString()
  @IsNotEmpty()
  initData: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginGoogleDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}

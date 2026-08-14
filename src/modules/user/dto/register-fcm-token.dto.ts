import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}

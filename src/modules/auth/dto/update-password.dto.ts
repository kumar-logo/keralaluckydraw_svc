import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;

  @IsOptional()
  @IsString()
  smsCode?: string;
}

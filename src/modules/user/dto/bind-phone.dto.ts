import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class BindPhoneDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  phone: string;

  @IsOptional()
  @IsString()
  smsCode?: string;
}

import { IsOptional, IsString, Length } from 'class-validator';

export class SendSmsDto {
  @IsOptional()
  @IsString()
  @Length(6, 20)
  phone?: string;

  @IsOptional()
  @IsString()
  purpose: string = 'login';
}

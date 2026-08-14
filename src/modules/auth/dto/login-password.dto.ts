import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  phone: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

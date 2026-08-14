import { IsNotEmpty, IsString } from 'class-validator';

export class BindGoogleDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

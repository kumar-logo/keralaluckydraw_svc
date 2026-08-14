import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateNicknameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nickname: string;
}

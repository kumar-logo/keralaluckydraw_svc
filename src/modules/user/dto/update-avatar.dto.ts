import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @IsNotEmpty()
  avatar: string;
}

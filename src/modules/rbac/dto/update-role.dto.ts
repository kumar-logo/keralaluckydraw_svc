import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  displayName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  level?: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}

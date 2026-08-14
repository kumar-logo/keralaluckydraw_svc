import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class SaveAppVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  version: string;

  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  minSupportedVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  androidPackageName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  updateMessage?: string;
}

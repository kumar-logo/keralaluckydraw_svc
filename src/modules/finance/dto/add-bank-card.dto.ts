import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddBankCardDto {
  @IsOptional()
  @IsString()
  holderName?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  cardNo?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

  @IsOptional()
  @IsString()
  upiAddress?: string;

  @IsOptional()
  @IsString()
  gpayId?: string;

  @IsOptional()
  @IsString()
  phonepeId?: string;

  @IsOptional()
  @IsString()
  userEmail?: string;
}

export class EditBankCardDto extends AddBankCardDto {
  @Type(() => Number)
  @IsNumber()
  id: number;
}

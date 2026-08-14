import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ColorDrawHistoryDto {
  @IsInt()
  @IsPositive()
  colorID: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  size: number = 10;
}

export class ColorOrderItemDto {
  @IsString()
  betType: string;

  @IsString()
  betNum: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class ColorCreateOrderDto {
  @IsInt()
  @IsPositive()
  colorID: number;

  @IsString()
  roundNo: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  betItem?: string;

  @IsOptional()
  @IsInt()
  multiples?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorOrderItemDto)
  orders?: ColorOrderItemDto[];

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;
}

export class ColorOrderListDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  colorID?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  size: number = 10;

  @IsOptional()
  @IsInt()
  orderStatus?: number;

  @IsOptional()
  @IsString()
  yearMonth?: string;
}

export class ColorDrawResultDto {
  @IsInt()
  @IsPositive()
  colorID: number;

  @IsString()
  roundNo: string;
}

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

export class DiceDrawHistoryDto {
  @IsInt()
  @IsPositive()
  diceID: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  size: number = 10;
}

export class DiceDrawAnalyzeDto {
  @IsInt()
  @IsPositive()
  diceID: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  size: number = 100;
}

export class DiceOrderItemDto {
  @IsString()
  betType: string;

  @IsString()
  betNum: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class DiceCreateOrderDto {
  @IsInt()
  @IsPositive()
  diceID: number;

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
  @Type(() => DiceOrderItemDto)
  orders?: DiceOrderItemDto[];

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;
}

export class DiceOrderListDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  diceID?: number;

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

export class DiceDrawResultDto {
  @IsInt()
  @IsPositive()
  diceID: number;

  @IsString()
  roundNo: string;
}

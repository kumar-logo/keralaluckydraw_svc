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

export class RaceOrderItemDto {
  @IsInt()
  orderType: number;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  betNum: string;
}

export class RaceCreateOrderDto {
  @IsInt()
  @IsPositive()
  gameID: number;

  @IsString()
  roundNo: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RaceOrderItemDto)
  orders: RaceOrderItemDto[];

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;
}

export class RaceDrawHistoryDto {
  @IsInt()
  @IsPositive()
  gameID: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize: number = 10;
}

export class RaceOrderListDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  gameID?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize: number = 10;

  @IsOptional()
  @IsInt()
  orderStatus?: number;

  @IsOptional()
  @IsString()
  yearMonth?: string;
}

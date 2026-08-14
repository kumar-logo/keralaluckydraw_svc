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

export class DubaiDrawHistoryDto {
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

export class DubaiOrderItemDto {
  @IsInt()
  @Min(0)
  number: number;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class DubaiCreateOrderDto {
  @IsInt()
  @IsPositive()
  gameID: number;

  @IsString()
  roundNo: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DubaiOrderItemDto)
  orders: DubaiOrderItemDto[];

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;
}

export class DubaiOrderListDto {
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

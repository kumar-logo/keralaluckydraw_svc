import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FourFiveDigitGameInfoDto {
  @IsInt()
  @IsPositive()
  gameID: number;
}

export class FourFiveDigitDrawHistoryDto {
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

export class FourFiveDigitManualHistoryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize: number = 10;
}

export class FourFiveDigitOrderDto {
  @IsInt()
  @Min(1)
  count: number;

  @IsString()
  number: string;

  @Transform(({ value }) =>
    typeof value === 'number' ? String(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsInt()
  slatProductId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  positions?: number[];
}

export class FourFiveDigitCreateOrderDto {
  @IsInt()
  @IsPositive()
  gameID: number;

  @IsString()
  roundNo: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FourFiveDigitOrderDto)
  orders: FourFiveDigitOrderDto[];

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;
}

export class FourFiveDigitOrderListDto {
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

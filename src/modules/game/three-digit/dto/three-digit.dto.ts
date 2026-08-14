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

export class ThreeDigitGameInfoDto {
  @IsInt()
  @IsPositive()
  gameID: number;
}

export class ThreeDigitDrawHistoryDto {
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
  size: number = 10;
}

export class ThreeDigitManualHistoryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize: number = 10;
}

export class ThreeDigitTicketDto {
  @IsString()
  level: string;

  @IsOptional()
  @IsString()
  index?: string;

  @IsString()
  number: string;

  @IsInt()
  @Min(1)
  count: number;

  @IsOptional()
  @IsInt()
  slatProductId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  positions?: number[];
}

export class ThreeDigitCreateOrderDto {
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
  @Type(() => ThreeDigitTicketDto)
  tickets: ThreeDigitTicketDto[];

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;
}

export class ThreeDigitOrderListDto {
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
  size: number = 10;

  @IsOptional()
  @IsInt()
  orderStatus?: number;

  @IsOptional()
  @IsString()
  yearMonth?: string;

  @IsOptional()
  @IsString()
  roundNo?: string;
}

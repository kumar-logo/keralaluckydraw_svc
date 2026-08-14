import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class KeralaDrawDetailDto {
  @IsInt()
  @IsPositive()
  keralaID: number;

  @IsString()
  roundNo: string;
}

export class KeralaRandomOrderDto {
  @IsInt()
  @IsPositive()
  keralaID: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  count: number = 1;
}

export class KeralaOrderCustomDto {
  @IsInt()
  @IsPositive()
  keralaID: number;

  @IsString()
  code: string;
}

export class KeralaCreateOrderDto {
  @IsInt()
  @IsPositive()
  keralaID: number;

  @IsString()
  roundNo: string;

  @IsArray()
  @IsString({ each: true })
  codes: string[];

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;
}

export class KeralaDrawDetailListDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  keralaID?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  size: number = 10;
}

export class KeralaOrderListDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  keralaID?: number;

  @IsOptional()
  @IsString()
  gameCode?: string;

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

import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { MAX_INSTANT_DRAWS } from '../../shared/profit-guard.constants';

export class LuckySpinDrawDto {
  @IsInt()
  @IsPositive()
  gameID: number;

  @IsOptional()
  @IsBoolean()
  isFree: boolean = false;

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INSTANT_DRAWS)
  count: number = 1;
}

export class LuckySpinDrawHistoryDto {
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

export class LuckySpinFreeHistoryDto {
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
  pageSize: number = 50;
}

import {
  IsInt,
  IsPositive,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { MAX_INSTANT_DRAWS } from '../../shared/profit-guard.constants';

export class MysteryBoxDrawDto {
  @IsInt()
  @IsPositive()
  gameID: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INSTANT_DRAWS)
  count: number = 1;

  @IsOptional()
  @IsBoolean()
  isBonus: boolean = false;
}

export class MysteryBoxDrawHistoryDto {
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

export class MysteryBoxBarrageDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  count: number = 20;
}

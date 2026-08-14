import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RankPeriod, RankType } from '../rank.enums';

export class RankInfoDto {
  @IsOptional()
  @IsEnum(RankType)
  rankType: RankType = RankType.Betting;

  @IsOptional()
  @IsEnum(RankPeriod)
  period: RankPeriod = RankPeriod.Today;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 20;
}

export class RankAwardDto {
  @IsOptional()
  @IsEnum(RankType)
  rankType: RankType = RankType.Betting;

  @IsOptional()
  @IsEnum(RankPeriod)
  period: RankPeriod = RankPeriod.Today;
}

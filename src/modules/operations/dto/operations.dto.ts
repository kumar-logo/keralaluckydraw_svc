import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

const LOBBY_CATEGORY_ID = 1020;

export class GameListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId: number = LOBBY_CATEGORY_ID;

  @IsOptional()
  @IsString()
  filterType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNum: number = 1;
}

export class SearchGamesDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNum: number = 1;
}

export class ShareListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 8;
}

export class ToggleCollectDto {
  @IsString()
  gameCode: string;

  @IsBoolean()
  collect: boolean;
}

export class CasinoGameUrlDto {
  @IsString()
  gameCode: string;

  @IsOptional()
  @IsString()
  lobbyUrl?: string;
}

export class RedeemCdKeyDto {
  @IsString()
  cdKey: string;
}

export class ShareClickDto {
  @Type(() => Number)
  @IsInt()
  id: number;
}

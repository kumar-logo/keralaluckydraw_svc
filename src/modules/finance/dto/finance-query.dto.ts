import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
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

export class RecordQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

export class TransactionQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class RebateQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class ClaimByIdDto {
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class VipLevelDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vipLevel: number;
}

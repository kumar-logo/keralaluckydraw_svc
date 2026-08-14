import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AgentReportDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startDate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endDate?: number;

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

export class AgentTableDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  level: number = 1;

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

export class AgentDetailDto {
  @Type(() => Number)
  @IsInt()
  userId: number;
}

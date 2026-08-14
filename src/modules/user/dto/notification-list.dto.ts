import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class NotificationListDto {
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

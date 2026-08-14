import { IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWithdrawalDto {
  @Type(() => Number)
  @IsNumber()
  bankcardId: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;
}

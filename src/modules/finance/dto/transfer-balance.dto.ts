import { IsNumber, IsPositive } from 'class-validator';

export class TransferBalanceDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}

import {
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export const UTR_PATTERN = /^\d{12}$/;

export class CreateRechargeDto {
  @IsNumber()
  payChannelId: number;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  proofImage?: string;

  @IsOptional()
  @IsString()
  @Matches(UTR_PATTERN, { message: 'paymentRef must be exactly 12 digits' })
  paymentRef?: string;
}

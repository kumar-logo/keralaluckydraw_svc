import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { DrawResult } from '../../game/shared/game-engine.service';

@ValidatorConstraint({ name: 'isJsonOrEmpty', async: false })
export class IsJsonOrEmptyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (trimmed.length === 0) return true;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'serviceAccountJson must be valid JSON or empty';
  }
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}

export class UpdateCronJobDto {
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateMessageDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}

export class SaveFirebaseConfigDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  authDomain?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  storageBucket?: string;

  @IsOptional()
  @IsString()
  messagingSenderId?: string;

  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsString()
  measurementId?: string;

  @IsOptional()
  @IsString()
  vapidKey?: string;

  @IsOptional()
  @Validate(IsJsonOrEmptyConstraint)
  serviceAccountJson?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  banReason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vipLevel?: number;
}

export class SetUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  newPassword: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  newPassword?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class SetDrawResultDto {
  @Type(() => Number)
  @IsInt()
  roundId: number;

  @IsDefined()
  result: DrawResult;

  @IsOptional()
  @IsString()
  gameType?: string;
}

export class UpdateOddsConfigDto {
  @IsArray()
  updates: OddsUpdateInput[];
}

export class OddsUpdateInput {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;

  @IsOptional()
  @IsString()
  betType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  odds?: number;

  @IsOptional()
  @IsString()
  gameType?: string;
}

const RESULT_MODES = [
  'random',
  'weighted',
  'min_payout',
  'max_profit',
  'lowest_risk',
  'manual',
];

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return value;
};

export class UpdateGameResultConfigDto {
  @IsOptional()
  @IsIn(RESULT_MODES)
  resultMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(0.95)
  houseEdgeTarget?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  holdForApproval?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  avoidBigPrize?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  avoidZeroOrder?: boolean;
}

export class TestSmsDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  smsEndpoint?: string;

  @IsOptional()
  @IsString()
  smsApiKey?: string;

  @IsOptional()
  @IsString()
  smsRoute?: string;

  @IsOptional()
  @IsString()
  smsSenderId?: string;

  @IsOptional()
  @IsString()
  smsTemplateId?: string;
}

export class TestWhatsappDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  whatsappEndpoint?: string;

  @IsOptional()
  @IsString()
  whatsappToken?: string;

  @IsOptional()
  @IsString()
  whatsappTemplateName?: string;

  @IsOptional()
  @IsString()
  whatsappLangCode?: string;
}

export class LotteryReportDownloadQueryDto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsString()
  gameType?: string;
}

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class RechargeListQueryDto {
  @Type(() => Number)
  @IsInt()
  pageNo: number;

  @Type(() => Number)
  @IsInt()
  pageSize: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class WithdrawListQueryDto {
  @Type(() => Number)
  @IsInt()
  pageNo: number;

  @Type(() => Number)
  @IsInt()
  pageSize: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class FinanceExportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

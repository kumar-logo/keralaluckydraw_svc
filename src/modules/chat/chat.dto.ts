import {
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  Matches,
  Min,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const trimmed = ({ value }: { value: unknown }): string =>
  typeof value === 'string' ? value.trim() : '';

const CHAT_IMAGE_PATH = /^\/uploads\/chat\/[A-Za-z0-9._-]+$/;

export class SendMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(CHAT_IMAGE_PATH)
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  replyToId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  mentions?: string[];
}

export class HistoryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeId?: number;

  @Transform(({ value }) => (value === undefined || value === null ? 30 : Number(value)))
  @IsInt()
  @Min(1)
  limit: number;
}

export class AfterDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterId: number;
}

export class ReadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  messageId: number;
}

export class MessageReadersDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  messageId: number;
}

export class AdminSendMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(CHAT_IMAGE_PATH)
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  replyToId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  mentions?: string[];
}

export class CreateGroupDto {
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsIn(['public', 'private'])
  type: string;

  @Transform(({ value }) => (typeof value === 'string' ? value : ''))
  @IsString()
  @MaxLength(255)
  avatar: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(['public', 'private'])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class MuteUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  userId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minutes?: number;

  @Transform(({ value }) => (typeof value === 'string' ? value : ''))
  @IsString()
  @MaxLength(255)
  reason: string;
}

export class UserIdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  userId: string;
}

export class MemberDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  userId: string;
}

export class ChatSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  blockLinks?: boolean;

  @IsOptional()
  @IsBoolean()
  imageEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  badWords?: string;
}

export class PageQueryDto {
  @Transform(({ value }) => (value === undefined || value === null ? 0 : Number(value)))
  @IsInt()
  @Min(0)
  skip: number;

  @Transform(({ value }) => (value === undefined || value === null ? 50 : Number(value)))
  @IsInt()
  @Min(1)
  take: number;
}

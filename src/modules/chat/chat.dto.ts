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
  Max,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { GroupType, JoinPolicy, Visibility, PostPolicy, MessageKind, DmScope } from './chat.enums';

const trimmed = ({ value }: { value: unknown }): string =>
  typeof value === 'string' ? value.trim() : '';

const CHAT_IMAGE_PATH = /^\/uploads\/chat\/[A-Za-z0-9._-]+$/;

const CHAT_AUDIO_PATH = /^\/uploads\/chat\/voice\/[A-Za-z0-9._-]+$/;

const DURATION_MS_MAX = 300000;

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

  @IsOptional()
  @IsEnum(MessageKind)
  kind?: MessageKind;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(CHAT_AUDIO_PATH)
  audioUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DURATION_MS_MAX)
  durationMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  audioWaveform?: string;
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

  @IsOptional()
  @IsEnum(MessageKind)
  kind?: MessageKind;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(CHAT_AUDIO_PATH)
  audioUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DURATION_MS_MAX)
  durationMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  audioWaveform?: string;
}

export class CreateGroupDto {
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(GroupType)
  type: string;

  @Transform(({ value }) => (typeof value === 'string' ? value : ''))
  @IsString()
  @MaxLength(255)
  avatar: string;

  @IsOptional()
  @IsEnum(JoinPolicy)
  joinPolicy?: JoinPolicy;

  @IsOptional()
  @IsEnum(PostPolicy)
  postPolicy?: PostPolicy;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : ''))
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(GroupType)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsEnum(JoinPolicy)
  joinPolicy?: JoinPolicy;

  @IsOptional()
  @IsEnum(PostPolicy)
  postPolicy?: PostPolicy;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : ''))
  @IsString()
  @MaxLength(255)
  description?: string;
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
  @IsBoolean()
  voiceEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  dmEnabled?: boolean;

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

export class JoinDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;
}

export class DiscoverQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cursor?: string;

  @Transform(({ value }) => (value === undefined || value === null ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  limit: number;
}

export class DmOpenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  userId: string;
}

export class DeliveredDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  messageId: number;
}

export class UserDmQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cursor?: string;
}

export class AdminDmQueryDto {
  @IsOptional()
  @IsEnum(DmScope)
  scope?: DmScope;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cursor?: string;
}

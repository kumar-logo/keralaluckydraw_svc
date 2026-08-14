import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'varchar', length: 32, unique: true })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nickname: string;

  @Column({
    type: 'varchar',
    length: 500,
    default: '/images/common/default-avatar.webp',
  })
  avatar: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  balance: number;

  @Column({
    name: 'withdrawable_balance',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  withdrawableBalance: number;

  @Column({
    name: 'bonus_balance',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  bonusBalance: number;

  @Column({ name: 'is_recharge', type: 'tinyint', default: 0 })
  isRecharge: number;

  @Column({ name: 'vip_level', type: 'tinyint', unsigned: true, default: 0 })
  vipLevel: number;

  @Index()
  @Column({
    name: 'invite_code',
    type: 'varchar',
    length: 20,
    unique: true,
    nullable: true,
  })
  inviteCode: string;

  @Index()
  @Column({ name: 'invited_by', type: 'varchar', length: 20, nullable: true })
  invitedBy: string;

  @Column({ name: 'tg_id', type: 'varchar', length: 100, nullable: true })
  tgId: string;

  @Column({ name: 'google_id', type: 'varchar', length: 100, nullable: true })
  googleId: string;

  @Column({
    name: 'channel_id',
    type: 'varchar',
    length: 50,
    default: 'default',
  })
  channelId: string;

  @Column({ name: 'visitor_id', type: 'varchar', length: 64, nullable: true })
  visitorId: string;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'ban_reason', type: 'varchar', length: 255, nullable: true })
  banReason: string | null;

  @Column({
    name: 'app_award',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  appAward: number;

  @Column({ type: 'int', default: 0 })
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

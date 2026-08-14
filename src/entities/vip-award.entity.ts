import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index(
  'uk_user_level_date_type',
  ['userId', 'vipLevel', 'awardDate', 'awardType'],
  {
    unique: true,
  },
)
@Entity('vip_awards')
export class VipAward {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'vip_level', type: 'tinyint', unsigned: true })
  vipLevel: number;

  @Column({ name: 'award_date', type: 'varchar', length: 10 })
  awardDate: string;

  @Column({ name: 'award_type', type: 'varchar', length: 10, default: 'daily' })
  awardType: string;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

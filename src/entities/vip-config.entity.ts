import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vip_levels')
export class VipConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'tinyint', unsigned: true, unique: true })
  level: number;

  @Column({ name: 'level_name', type: 'varchar', length: 50, nullable: true })
  levelName: string;

  @Column({
    name: 'recharge_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  minRecharge: number;

  @Column({
    name: 'bet_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  minBet: number;

  @Column({
    name: 'award_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  dailyReward: number;

  @Column({
    name: 'monthly_reward',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  monthlyReward: number;

  @Column({
    name: 'rebate_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
  })
  rebateRate: number;

  @Column({
    name: 'withdraw_limit',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  withdrawLimit: number;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, default: '' })
  iconUrl: string;

  @Column({ name: 'level_color', type: 'varchar', length: 20, default: '' })
  levelColor: string;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

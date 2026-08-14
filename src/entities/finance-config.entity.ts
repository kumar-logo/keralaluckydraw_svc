import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('finance_config')
export class FinanceConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({
    name: 'withdraw_fee_rate',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.02,
  })
  withdrawFeeRate: number;

  @Column({
    name: 'withdraw_min_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 100,
  })
  withdrawMinAmount: number;

  @Column({
    name: 'withdraw_max_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 50000,
  })
  withdrawMaxAmount: number;

  @Column({ name: 'withdraw_daily_count', type: 'int', default: 3 })
  withdrawDailyCount: number;

  @Column({
    name: 'withdraw_min_bet_multiplier',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 1,
  })
  withdrawMinBetMultiplier: number;

  @Column({
    name: 'withdraw_explain',
    type: 'varchar',
    length: 500,
    default: '',
  })
  withdrawExplain: string;

  @Column({
    name: 'recharge_min_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 100,
  })
  rechargeMinAmount: number;

  @Column({
    name: 'recharge_max_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 100000,
  })
  rechargeMaxAmount: number;

  @Column({
    name: 'wage_rate',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.001,
  })
  wageRate: number;

  @Column({
    name: 'wage_min_bet',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  wageMinBet: number;

  @Column({
    name: 'transfer_min_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 10,
  })
  transferMinAmount: number;

  @Column({
    name: 'transfer_max_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 100000,
  })
  transferMaxAmount: number;

  @Column({
    name: 'new_user_bonus',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  newUserBonus: number;

  @Column({
    name: 'first_recharge_bonus',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0,
  })
  firstRechargeBonus: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

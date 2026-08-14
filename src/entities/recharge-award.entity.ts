import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('recharge_awards')
export class RechargeAward {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'award_name', type: 'varchar', length: 100, nullable: true })
  awardName: string;

  @Column({ name: 'award_type', type: 'varchar', length: 30, nullable: true })
  awardType: string;

  @Column({
    name: 'min_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 0.0,
  })
  minAmount: number;

  @Column({
    name: 'max_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 999999.0,
  })
  maxAmount: number;

  @Column({
    name: 'bonus_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
    default: 0.0,
  })
  bonusRate: number;

  @Column({
    name: 'bonus_fixed',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 0.0,
  })
  bonusFixed: number;

  @Column({
    name: 'max_bonus',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 999999.0,
  })
  maxBonus: number;

  @Column({ name: 'sort_order', type: 'int', nullable: true, default: 0 })
  sortOrder: number;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

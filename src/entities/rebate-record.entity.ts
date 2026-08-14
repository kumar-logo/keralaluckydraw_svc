import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('rebate_records')
@Index('uk_user_date_game', ['userId', 'dateKey', 'gameType'], { unique: true })
export class RebateRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'date_key', type: 'varchar', length: 10 })
  dateKey: string;

  @Column({ name: 'game_type', type: 'varchar', length: 30 })
  gameType: string;

  @Column({
    name: 'bet_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  betAmount: number;

  @Column({
    name: 'rebate_rate',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0,
  })
  rebateRate: number;

  @Column({
    name: 'rebate_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  rebateAmount: number;

  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

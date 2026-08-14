import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('uk_user_week', ['userId', 'weekKey'], { unique: true })
@Entity('wage_records')
export class WageRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'week_key', type: 'varchar', length: 20 })
  weekKey: string;

  @Column({
    name: 'cond_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 0.0,
  })
  condAmount: number;

  @Column({
    name: 'rc_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 0.0,
  })
  rcAmount: number;

  @Column({
    name: 'wage_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 0.0,
  })
  wageAmount: number;

  @Column({
    name: 'is_claim',
    type: 'tinyint',
    width: 1,
    nullable: true,
    default: 0,
  })
  isClaim: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

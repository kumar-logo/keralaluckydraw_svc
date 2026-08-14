import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('orders')
@Index('idx_round_status', ['roundNo', 'gameType', 'status'])
@Index('idx_user_game', ['userId', 'gameType', 'createdAt'])
@Index('idx_game_round_status', ['gameId', 'roundNo', 'status'])
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'order_no', type: 'varchar', length: 64, unique: true })
  orderNo: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'game_type', type: 'varchar', length: 30 })
  gameType: string;

  @Column({ name: 'round_no', type: 'varchar', length: 30 })
  roundNo: string;

  @Column({ name: 'bet_type', type: 'varchar', length: 30, nullable: true })
  betType: string;

  @Column({ name: 'bet_content', type: 'json' })
  betContent: unknown;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 16, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  odds: number;

  @Column({
    name: 'win_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  winAmount: number;

  @Column({ name: 'is_bonus', type: 'tinyint', default: 0 })
  isBonus: number;

  @Index()
  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date;
}

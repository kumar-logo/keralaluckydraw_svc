import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('game_rounds')
@Index('uk_game_round', ['gameId', 'roundNo'], { unique: true })
export class GameRound {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'round_no', type: 'varchar', length: 30 })
  roundNo: string;

  @Column({ name: 'game_type', type: 'varchar', length: 30 })
  gameType: string;

  @Index()
  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @Index()
  @Column({ name: 'draw_time', type: 'timestamp', nullable: true })
  drawTime: Date;

  @Column({ type: 'json', nullable: true })
  result: unknown;

  @Column({
    name: 'total_bet',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalBet: number;

  @Column({
    name: 'total_payout',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalPayout: number;

  @Column({ name: 'stop_bet_time', type: 'timestamp', nullable: true })
  stopBetTime: Date;

  @Column({ name: 'manual_result', type: 'tinyint', default: 0 })
  manualResult: number;

  @Column({ name: 'settled_by', type: 'varchar', length: 30, nullable: true })
  settledBy: string;

  @Index('idx_result_status')
  @Column({
    name: 'result_status',
    type: 'varchar',
    length: 20,
    default: 'auto',
  })
  resultStatus: string;

  @Column({ name: 'result_mode', type: 'varchar', length: 20, nullable: true })
  resultMode: string;

  @Column({ name: 'proposed_result', type: 'json', nullable: true })
  proposedResult: unknown;

  @Column({ name: 'proposed_by', type: 'varchar', length: 30, nullable: true })
  proposedBy: string;

  @Column({ name: 'approved_by', type: 'varchar', length: 30, nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'created_by', type: 'varchar', length: 30, nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 30, nullable: true })
  updatedBy: string;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt: Date | null;
}

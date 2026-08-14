import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('result_decisions')
export class ResultDecision {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_rd_round')
  @Column({ name: 'round_id', type: 'bigint', unsigned: true })
  roundId: number;

  @Index('idx_rd_game')
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'game_type', type: 'varchar', length: 30 })
  gameType: string;

  @Index('idx_rd_mode')
  @Column({ type: 'varchar', length: 20 })
  mode: string;

  @Column({ name: 'decided_by', type: 'varchar', length: 30 })
  decidedBy: string;

  @Column({ name: 'candidates_evaluated', type: 'int', default: 0 })
  candidatesEvaluated: number;

  @Column({ name: 'candidate_space', type: 'int', default: 0 })
  candidateSpace: number;

  @Column({ type: 'tinyint', default: 0 })
  sampled: number;

  @Column({ name: 'chosen_result', type: 'json', nullable: true })
  chosenResult: unknown;

  @Column({
    name: 'total_stake',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalStake: number;

  @Column({
    name: 'total_payout',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalPayout: number;

  @Column({
    name: 'profit_loss',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  profitLoss: number;

  @Column({
    name: 'house_edge_target',
    type: 'decimal',
    precision: 6,
    scale: 4,
    nullable: true,
  })
  houseEdgeTarget: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

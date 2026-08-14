import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('rank_config_prize')
export class RankConfigPrize {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index('idx_rank_config')
  @Column({ name: 'rank_config_id', type: 'int', unsigned: true })
  rankConfigId: number;

  @Column({ name: 'rank_position', type: 'int' })
  rankPosition: number;

  @Column({
    name: 'prize_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  prizeAmount: number;
}

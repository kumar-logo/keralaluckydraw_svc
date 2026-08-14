import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('game_payout_ledger')
export class GamePayoutLedger {
  @PrimaryColumn({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({
    name: 'cumulative_stake',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  cumulativeStake: number;

  @Column({
    name: 'cumulative_payout',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  cumulativePayout: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

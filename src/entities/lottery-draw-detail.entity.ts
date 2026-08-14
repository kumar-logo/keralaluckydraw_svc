import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_game_round', ['gameId', 'roundNo'])
@Entity('lottery_draw_details')
export class LotteryDrawDetail {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'round_no', type: 'varchar', length: 30 })
  roundNo: string;

  @Column({ name: 'prize_tier', type: 'varchar', length: 30, nullable: true })
  prizeTier: string;

  @Column({ name: 'prize_name', type: 'varchar', length: 100, nullable: true })
  prizeName: string;

  @Column({
    name: 'prize_amt',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  prizeAmt: number;

  @Column({ type: 'longtext', nullable: true })
  numbers: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_daily_reward')
export class GameDailyReward {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  amount: number;
}

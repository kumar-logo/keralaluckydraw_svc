import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_pick_prize')
export class GamePickPrize {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ type: 'tinyint' })
  variant: number;

  @Column({ type: 'int' })
  level: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  prize: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_pick_time')
export class GamePickTime {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'time_name', type: 'varchar', length: 30 })
  timeName: string;

  @Column({ name: 'draw_time', type: 'varchar', length: 20 })
  drawTime: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

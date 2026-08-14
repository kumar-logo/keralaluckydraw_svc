import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_wheel_segment')
export class GameWheelSegment {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ type: 'varchar', length: 20 })
  name: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  prize: number;

  @Column({ type: 'int', default: 0 })
  weight: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  odds: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

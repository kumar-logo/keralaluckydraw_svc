import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_position_color')
export class GamePositionColor {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'position', type: 'int' })
  position: number;

  @Column({ name: 'color', type: 'varchar', length: 20 })
  color: string;

  @Column({ name: 'gradient', type: 'varchar', length: 60, nullable: true })
  gradient: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

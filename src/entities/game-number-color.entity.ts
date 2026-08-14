import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_number_color')
export class GameNumberColor {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'number', type: 'int' })
  number: number;

  @Column({ name: 'color_key', type: 'varchar', length: 32 })
  colorKey: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

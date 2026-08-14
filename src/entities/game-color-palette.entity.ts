import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_color_palette')
export class GameColorPalette {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'color_key', type: 'varchar', length: 32 })
  colorKey: string;

  @Column({ name: 'hex', type: 'varchar', length: 32 })
  hex: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Index('idx_ui_color_map_digit', ['digit'])
@Entity('ui_color_map')
export class UiColorMap {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'digit', type: 'int' })
  digit: number;

  @Column({ name: 'color', type: 'varchar', length: 20 })
  color: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

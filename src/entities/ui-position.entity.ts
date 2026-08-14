import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ui_position')
export class UiPosition {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'color', type: 'varchar', length: 20 })
  color: string;

  @Column({ name: 'gradient_from', type: 'varchar', length: 20 })
  gradientFrom: string;

  @Column({ name: 'gradient_to', type: 'varchar', length: 20 })
  gradientTo: string;
}

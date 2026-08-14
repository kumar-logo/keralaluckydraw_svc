import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ui_state')
export class UiState {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'name', type: 'varchar', length: 60 })
  name: string;

  @Column({ name: 'color', type: 'varchar', length: 20 })
  color: string;
}

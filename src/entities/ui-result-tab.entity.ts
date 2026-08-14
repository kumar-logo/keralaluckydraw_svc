import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ui_result_tab')
export class UiResultTab {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'tab_key', type: 'varchar', length: 40 })
  key: string;

  @Column({ name: 'label', type: 'varchar', length: 60 })
  label: string;
}

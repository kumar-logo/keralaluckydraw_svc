import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ui_mystery_box_gradient')
export class UiMysteryBoxGradient {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'gradient', type: 'varchar', length: 200 })
  gradient: string;
}

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ui_pay_rate')
export class UiPayRate {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'odds', type: 'decimal', precision: 10, scale: 4 })
  odds: number;

  @Column({ name: 'type', type: 'int' })
  type: number;
}

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('recharge_preset')
export class RechargePreset {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50, default: '' })
  mark: string;

  @Column({ name: 'bonus_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  bonusPct: number;
}

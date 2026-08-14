import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('transfer_tier')
export class TransferTier {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'min_amount', type: 'decimal', precision: 16, scale: 2 })
  minAmount: number;

  @Column({ name: 'max_amount', type: 'decimal', precision: 16, scale: 2 })
  maxAmount: number;

  @Column({ type: 'decimal', precision: 6, scale: 4, default: 0 })
  pct: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

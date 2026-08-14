import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('transfer_records')
export class TransferRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_user_id')
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: number;

  @Column({
    name: 'give_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  giveAmount: number;

  @Column({ type: 'varchar', length: 20 })
  direction: string;

  @Column({ type: 'int', default: 1 })
  status: number;

  @Column({ name: 'order_no', type: 'varchar', length: 64, default: '' })
  orderNo: string;

  @Column({
    name: 'balance_after',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  balanceAfter: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('withdrawal_records')
export class WithdrawalRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'order_no', type: 'varchar', length: 64, unique: true })
  orderNo: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({
    name: 'bankcard_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  bankcardId: number;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  fee: number;

  @Column({
    name: 'actual_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  actualAmount: number;

  @Index()
  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @Column({ type: 'varchar', length: 500, default: '' })
  remark: string;

  @Column({ name: 'admin_id', type: 'int', unsigned: true, nullable: true })
  adminId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

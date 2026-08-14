import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('recharge_records')
export class RechargeRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'order_no', type: 'varchar', length: 64, unique: true })
  orderNo: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'channel_id', type: 'int', unsigned: true, nullable: true })
  channelId: number;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: number;

  @Column({
    name: 'actual_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  actualAmount: number;

  @Column({
    name: 'bonus_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  bonusAmount: number;

  @Index()
  @Column({ type: 'tinyint', default: 0 })
  status: number;

  @Column({ name: 'pay_url', type: 'varchar', length: 1000, nullable: true })
  payUrl: string;

  @Column({ name: 'callback_data', type: 'text', nullable: true })
  callbackData: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  remark: string;

  @Index('UQ_recharge_records_payment_ref', { unique: true })
  @Column({ name: 'payment_ref', type: 'varchar', length: 100, nullable: true })
  paymentRef: string;

  @Column({
    name: 'proof_image',
    type: 'mediumtext',
    nullable: true,
    select: false,
  })
  proofImage: string;

  @Column({
    name: 'approved_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

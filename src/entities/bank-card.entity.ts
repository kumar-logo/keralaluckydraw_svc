import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('bank_cards')
export class BankCard {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'card_name', type: 'varchar', length: 100, nullable: true })
  cardName: string;

  @Column({ name: 'holder_name', type: 'varchar', length: 100, nullable: true })
  holderName: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ name: 'card_number', type: 'varchar', length: 50, nullable: true })
  cardNumber: string;

  @Column({ name: 'ifsc_code', type: 'varchar', length: 20, nullable: true })
  ifscCode: string;

  @Column({ name: 'upi_address', type: 'varchar', length: 100, nullable: true })
  upiAddress: string;

  @Column({ name: 'gpay_id', type: 'varchar', length: 100, nullable: true })
  gpayId: string;

  @Column({ name: 'phonepe_id', type: 'varchar', length: 100, nullable: true })
  phonepeId: string;

  @Column({ name: 'user_email', type: 'varchar', length: 100, nullable: true })
  userEmail: string;

  @Column({ name: 'is_default', type: 'tinyint', default: 0 })
  isDefault: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

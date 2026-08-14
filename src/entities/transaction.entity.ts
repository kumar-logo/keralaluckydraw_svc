import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Index()
  @Column({ name: 'source_type', type: 'varchar', length: 30 })
  sourceType: string;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  balance: number;

  @Column({ name: 'ref_id', type: 'varchar', length: 64, nullable: true })
  refId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

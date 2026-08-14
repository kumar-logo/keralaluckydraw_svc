import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('cdkey_codes')
export class CdkeyCode {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'cd_key', type: 'varchar', length: 50, unique: true })
  cdKey: string;

  @Column({
    name: 'award_type',
    type: 'varchar',
    length: 30,
    nullable: true,
    default: 'balance',
  })
  awardType: string;

  @Column({ name: 'award_amount', type: 'decimal', precision: 16, scale: 2 })
  awardAmount: number;

  @Column({ name: 'max_uses', type: 'int', nullable: true, default: 1 })
  maxUses: number;

  @Column({ name: 'used_count', type: 'int', nullable: true, default: 0 })
  usedCount: number;

  @Column({ name: 'expired_at', type: 'timestamp', nullable: true })
  expiredAt: Date;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

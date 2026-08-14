import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_phone_code', ['phone', 'code'])
@Entity('sms_codes')
export class SmsCode {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 10 })
  code: string;

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'login' })
  type: string;

  @Column({ type: 'varchar', length: 20, default: 'sms' })
  channel: string;

  @Column({ name: 'expired_at', type: 'timestamp', nullable: true })
  expiredAt: Date;

  @Column({ type: 'tinyint', width: 1, nullable: true, default: 0 })
  used: number;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

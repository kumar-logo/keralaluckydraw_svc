import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('uk_cdkey_user', ['cdkeyId', 'userId'], { unique: true })
@Entity('cdkey_usage')
export class CdkeyUsage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'cdkey_id', type: 'bigint', unsigned: true })
  cdkeyId: number;

  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

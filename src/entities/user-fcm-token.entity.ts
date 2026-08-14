import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('user_fcm_tokens')
@Unique('uk_fcm_token', ['token'])
export class UserFcmToken {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_fcm_user')
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ type: 'varchar', length: 512 })
  token: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

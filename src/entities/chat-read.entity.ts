import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('chat_read')
@Index('uk_chat_read', ['groupId', 'userId'], { unique: true })
@Index('idx_chat_read_user', ['userId', 'groupId', 'lastReadId'])
export class ChatRead {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'group_id', type: 'int', unsigned: true })
  groupId: number;

  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'last_read_id', type: 'bigint', unsigned: true, default: 0 })
  lastReadId: number;

  @UpdateDateColumn({ name: 'updated_at', precision: 6 })
  updatedAt: Date;
}

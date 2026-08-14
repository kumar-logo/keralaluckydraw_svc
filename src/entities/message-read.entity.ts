import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('message_read')
@Unique('uk_message_user', ['messageId', 'userId'])
export class MessageRead {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'message_id', type: 'bigint', unsigned: true })
  messageId: number;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ type: 'tinyint', default: 0 })
  hidden: number;

  @CreateDateColumn({ name: 'read_at' })
  readAt: Date;
}

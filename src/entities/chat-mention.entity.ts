import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('chat_mention')
@Index('uk_mention_msg_user', ['messageId', 'userId'], { unique: true })
@Index('idx_mention_unread', ['userId', 'groupId', 'messageId'])
export class ChatMention {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'group_id', type: 'int', unsigned: true })
  groupId: number;

  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'message_id', type: 'bigint', unsigned: true })
  messageId: number;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}

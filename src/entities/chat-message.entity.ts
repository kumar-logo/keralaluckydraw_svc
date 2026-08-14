import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('chat_message')
@Index('idx_chat_group', ['groupId', 'status', 'id'])
export class ChatMessage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'group_id', type: 'int', unsigned: true, default: 1 })
  groupId: number;

  @Index('idx_chat_user')
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'sender_role', type: 'varchar', length: 16, default: 'user' })
  senderRole: string;

  @Column({ name: 'sender_name', type: 'varchar', length: 64, default: '' })
  senderName: string;

  @Column({ name: 'sender_avatar', type: 'varchar', length: 255, default: '' })
  senderAvatar: string;

  @Column({ type: 'varchar', length: 1000, default: '' })
  content: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'reply_to_id', type: 'bigint', unsigned: true, nullable: true })
  replyToId: number | null;

  @Column({ name: 'mentions', type: 'varchar', length: 500, nullable: true })
  mentions: string | null;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}

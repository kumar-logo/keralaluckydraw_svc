import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('chat_group')
export class ChatGroup {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100, default: 'Community Chat' })
  name: string;

  @Column({ type: 'varchar', length: 16, default: 'public' })
  type: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  avatar: string;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'created_by', type: 'varchar', length: 32, default: '' })
  createdBy: string;

  @Column({ name: 'join_policy', type: 'varchar', length: 16, default: 'auto' })
  joinPolicy: string;

  @Column({ name: 'post_policy', type: 'varchar', length: 16, default: 'all' })
  postPolicy: string;

  @Column({ type: 'varchar', length: 16, default: 'listed' })
  visibility: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  description: string;

  @Column({ name: 'member_count', type: 'int', unsigned: true, default: 0 })
  memberCount: number;

  @Column({
    name: 'last_message_id',
    type: 'bigint',
    unsigned: true,
    default: 0,
  })
  lastMessageId: number;

  @Column({ name: 'last_message_at', type: 'datetime', precision: 6, nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'is_dm', type: 'tinyint', default: 0 })
  isDm: number;

  @Column({ name: 'dm_key', type: 'varchar', length: 80, nullable: true })
  dmKey: string | null;

  @Column({ name: 'dm_admin_id', type: 'varchar', length: 32, nullable: true })
  dmAdminId: string | null;

  @Column({ name: 'dm_user_id', type: 'varchar', length: 32, nullable: true })
  dmUserId: string | null;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}

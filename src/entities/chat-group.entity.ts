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

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}

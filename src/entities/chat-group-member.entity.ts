import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('chat_group_member')
@Unique('uk_group_member', ['groupId', 'userId'])
export class ChatGroupMember {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'group_id', type: 'int', unsigned: true })
  groupId: number;

  @Index('idx_member_user')
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}

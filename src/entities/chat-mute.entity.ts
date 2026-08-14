import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('chat_mute')
export class ChatMute {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'varchar', length: 32, unique: true })
  userId: string;

  @Column({ name: 'muted_until', type: 'datetime', nullable: true })
  mutedUntil: Date | null;

  @Column({ type: 'varchar', length: 255, default: '' })
  reason: string;

  @Column({ name: 'created_by', type: 'varchar', length: 32, default: '' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}

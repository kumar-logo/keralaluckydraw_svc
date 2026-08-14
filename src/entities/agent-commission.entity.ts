import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('agent_commissions')
export class AgentCommission {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_user_id')
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Index('idx_from_user')
  @Column({ name: 'from_user', type: 'varchar', length: 32 })
  fromUser: string;

  @Column({ name: 'source_type', type: 'varchar', length: 30, nullable: true })
  sourceType: string;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  commission: number;

  @Column({ name: 'level_depth', type: 'tinyint', nullable: true, default: 1 })
  levelDepth: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

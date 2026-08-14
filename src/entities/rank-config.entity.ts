import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('rank_config')
export class RankConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'rank_id', type: 'int', unique: true })
  rankId: number;

  @Column({ name: 'rank_name', type: 'varchar', length: 100, nullable: true })
  rankName: string;

  @Column({ name: 'rank_type', type: 'varchar', length: 30, nullable: true })
  rankType: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  period: string;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

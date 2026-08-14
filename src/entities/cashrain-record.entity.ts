import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('cashrain_records')
export class CashrainRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_user_id')
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'round_no', type: 'varchar', length: 30, nullable: true })
  roundNo: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  prize: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

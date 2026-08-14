import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_rank_round', ['rankId', 'roundNo'])
@Entity('rank_records')
export class RankRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'rank_id', type: 'int' })
  rankId: number;

  @Column({ name: 'round_no', type: 'varchar', length: 30 })
  roundNo: string;

  @Index('idx_user_id')
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 0.0,
  })
  score: number;

  @Column({ name: 'rank_pos', type: 'int', nullable: true })
  rankPos: number;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 0.0,
  })
  prize: number;

  @Column({
    name: 'is_claimed',
    type: 'tinyint',
    width: 1,
    nullable: true,
    default: 0,
  })
  isClaimed: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

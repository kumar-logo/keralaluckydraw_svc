import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('wheel_draw_history')
export class WheelDrawHistory {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_user_id')
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'wheel_id', type: 'int', unsigned: true })
  wheelId: number;

  @Column({ name: 'segment_idx', type: 'int' })
  segmentIdx: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  prize: number;

  @Column({
    name: 'is_free',
    type: 'tinyint',
    width: 1,
    nullable: true,
    default: 0,
  })
  isFree: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('race_runner_frames')
@Index('uk_game_round', ['gameId', 'roundNo'], { unique: true })
export class RaceRunnerFrame {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'round_no', type: 'varchar', length: 30 })
  roundNo: string;

  @Column({ type: 'json' })
  frames: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

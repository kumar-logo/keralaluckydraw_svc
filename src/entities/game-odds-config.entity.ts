import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('game_odds_config')
@Index('uk_game_bet', ['gameId', 'betType'], { unique: true })
export class GameOddsConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'game_type', type: 'varchar', length: 30 })
  gameType: string;

  @Column({ name: 'bet_type', type: 'varchar', length: 50 })
  betType: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 1 })
  odds: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'created_by', type: 'varchar', length: 30, nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 30, nullable: true })
  updatedBy: string;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

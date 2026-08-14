import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('game_fee_config')
@Index('idx_game_fee', ['gameId', 'feeType'], { unique: true })
export class GameFeeConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'game_type', type: 'varchar', length: 30 })
  gameType: string;

  @Column({ name: 'fee_type', type: 'varchar', length: 30 })
  feeType: string;

  @Column({
    name: 'fee_rate',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0,
  })
  feeRate: number;

  @Column({
    name: 'fixed_fee',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  fixedFee: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
} from 'typeorm';
import { SlatMatchMode } from '../common/enums';
import { GameSlatTier } from './game-slat-tier.entity';

@Entity('game_slat_product')
@Index('idx_slat_game_mode', ['gameId', 'matchMode'])
@Index('idx_slat_game_sort', ['gameId', 'sortOrder'])
export class GameSlatProduct {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'digit_count', type: 'tinyint' })
  digitCount: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  price: number;

  @Column({ name: 'match_mode', type: 'varchar', length: 10 })
  matchMode: SlatMatchMode;

  @Column({ type: 'varchar', length: 50, default: '' })
  title: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @OneToMany(() => GameSlatTier, (tier) => tier.product)
  tiers: GameSlatTier[];
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GameSlatProduct } from './game-slat-product.entity';

@Entity('game_slat_tier')
export class GameSlatTier {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'product_id', type: 'int', unsigned: true })
  productId: number;

  @Column({ type: 'varchar', length: 16 })
  label: string;

  @Column({ name: 'member_positions', type: 'varchar', length: 32 })
  memberPositions: string;

  @Column({
    name: 'win_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  winAmount: number;

  @Column({ name: 'tier_rank', type: 'int', default: 0 })
  tierRank: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => GameSlatProduct, (product) => product.tiers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: GameSlatProduct;
}

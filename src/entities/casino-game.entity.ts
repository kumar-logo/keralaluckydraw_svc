import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('casino_games')
export class CasinoGame {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'game_code', type: 'varchar', length: 100, unique: true })
  gameCode: string;

  @Column({ name: 'game_name', type: 'varchar', length: 200 })
  gameName: string;

  @Index('idx_provider')
  @Column({ name: 'provider_id', type: 'int', unsigned: true, nullable: true })
  providerId: number;

  @Index('idx_category')
  @Column({ name: 'category_id', type: 'int', unsigned: true, nullable: true })
  categoryId: number;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string;

  @Column({
    name: 'is_hot',
    type: 'tinyint',
    width: 1,
    nullable: true,
    default: 0,
  })
  isHot: number;

  @Column({ name: 'sort_order', type: 'int', nullable: true, default: 0 })
  sortOrder: number;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

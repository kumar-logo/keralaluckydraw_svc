import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_asset')
export class GameAsset {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'asset_type', type: 'varchar', length: 32 })
  assetType: string;

  @Column({ name: 'number', type: 'int', nullable: true })
  number: number | null;

  @Column({ name: 'url', type: 'varchar', length: 512 })
  url: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

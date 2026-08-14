import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_box_item')
export class GameBoxItem {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'item_id', type: 'int', default: 0 })
  itemId: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  prize: number;

  @Column({
    name: 'rate',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  rate: number;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl: string;

  @Column({ name: 'img_id', type: 'varchar', length: 64, nullable: true })
  imgId: string;

  @Column({ name: 'link_url', type: 'varchar', length: 1000, nullable: true })
  linkUrl: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('game_box_config')
export class GameBoxConfig {
  @PrimaryColumn({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'coin_type', type: 'int', default: 1 })
  coinType: number;

  @Column({ name: 'free_count', type: 'int', default: 0 })
  freeCount: number;

  @Column({ name: 'icon_img_id', type: 'varchar', length: 64, nullable: true })
  iconImgId: string;

  @Column({ name: 'cover_img_id', type: 'varchar', length: 64, nullable: true })
  coverImgId: string;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl: string;
}
